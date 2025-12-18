// ==UserScript==
// @name        ndic
// @version     0.1.0
// @namespace   ndic
// @license     MIT
// @match       *://*/*
// @connect     dict.naver.com
// @grant       GM_addStyle
// @grant       GM_xmlhttpRequest
// @run-at      document-body
// ==/UserScript==

GM_addStyle(`
    .ndic {
        all: revert;
        z-index: 9999;
        overflow: auto;
        resize: both;
        position: absolute;
        display: flex;
        flex-direction: column;
        gap: 1em;
        padding: 1em;
        box-shadow: 0 0 10px rgba(0, 0, 0, 0.25);
        box-sizing: border-box;
        background-color: #ffdd6dff;
        font-family: serif;
        font-size: 14px;
        line-height: 1;
        color: black;
    }
    .ndic:empty {
        resize: none;
        height: 7px;
        margin: 0;
        padding: 0;
        box-shadow: none;
        background: linear-gradient(180deg,rgba(255, 255, 255, 0) 0%, rgba(255, 74, 74, 1) 100%);
        cursor: pointer;
    }

    .ndic.dragging {
        cursor: move;
        user-select: none;
    }
    .ndic.sticky {
        position: fixed;
    }
    .ndic.preserve {
        opacity: .5;
    }
    .ndic.preserve:hover {
        opacity: 1;
    }

    .ndic-phonetic {
        display: none;
    }
    .ndic-error {
        text-decoration: underline;
        color: darkred;
    }

    .ndic article {
        display: flex;
        flex-direction: column;
        gap: .25em;
        word-break: keep-all;
        word-wrap: break-word;
        line-height: 1.25;
    }

    .ndic article header {
        display: flex;
        margin: 0;
        padding: 0;
        gap: .25em;
        align-items: center;
        font-size: 1.75em;
    }

    /* https://github.com/lafeber/world-flags-sprite */
    .ndic article header:before {
        content: ' ';
        display: inline-block;
        width: 16px;
        height: 16px;
        background-image: url('https://raw.githubusercontent.com/lafeber/world-flags-sprite/refs/heads/master/images/flags16.png');
        background-repeat: no-repeat;
    }
    .ndic article[data-lang=zh_CN] header:before { background-position: 0 -1040px }
    .ndic article[data-lang=zh] header:before { background-position: 0 -1040px }
    .ndic article[data-lang=de] header:before { background-position: 0 -1152px }
    .ndic article[data-lang=es] header:before { background-position: 0 -1328px }
    .ndic article[data-lang=cs] header:before { background-position: 0 -1136px }
    .ndic article[data-lang=fr] header:before { background-position: 0 -1424px }
    .ndic article[data-lang=hr] header:before { background-position: 0 -1744px }
    .ndic article[data-lang=hu] header:before { background-position: 0 -1776px }
    .ndic article[data-lang=id] header:before { background-position: 0 -1792px }
    .ndic article[data-lang=it] header:before { background-position: 0 -1920px }
    .ndic article[data-lang=ja] header:before { background-position: 0 -1984px }
    .ndic article[data-lang=ko] header:before { background-position: 0 -2112px }
    .ndic article[data-lang=nl] header:before { background-position: 0 -2752px }
    .ndic article[data-lang=pl] header:before { background-position: 0 -2944px }
    .ndic article[data-lang=pt] header:before { background-position: 0 -2992px }
    .ndic article[data-lang=ro] header:before { background-position: 0 -3072px }
    .ndic article[data-lang=ru] header:before { background-position: 0 -3104px }
    .ndic article[data-lang=sv] header:before { background-position: 0 -3360px }
    .ndic article[data-lang=th] header:before { background-position: 0 -3456px }
    .ndic article[data-lang=tl] header:before { background-position: 0 -3488px }
    .ndic article[data-lang=tr] header:before { background-position: 0 -3552px }
    .ndic article[data-lang=en] header:before { background-position: 0 -3664px }

    .ndic article header button {
        cursor: pointer;
        display: inline;
        padding: 0;
        border: 0;
        background: 0;
        font-size: 1rem;
        color: black;
    }

    .ndic article li[data-order] > span:first-child {
        font-size: 1.25em;
        font-weight: 900;
    }

    .ndic a[href] {
        text-decoration: underline;
        color: black !important;
    }

    .ndic ul {
        margin: 0;
        padding: 0;
        list-style: none;
    }
`)

const pointer = { x: 0, y : 0 }

const $audio = new Audio()
$audio.classList.add('ndic-phonetic')
document.body.append($audio)

/**
 * 웹으로부터 요청 결과를 가져옵니다
 * @param {object} details 
 */
function fetch (details) {
    return new Promise((resolve, reject) => {
        GM_xmlhttpRequest({
            timeout: 5000,
            ...details,
            onabort: () => reject(new Error('Aborted')),
            ontimeout: () => reject(new Error('Timed out')),
            onerror: e => reject(new Error(e.statusText)),
            onload: resolve
        })
    })
}

/**
 * 네이버 사전으로부터 검색 결과를 가져옵니다
 * @param {string} query
 * @returns {Promise<object[]>}
 */
async function fetchEntries (query) {
    const {response} = await fetch({
        url: 'https://dict.naver.com/dict.search?query=' + encodeURIComponent(query),
        headers: {
            'User-Agent': '(Android)'
        }
    })

    const match = response.match(/window\.__NUXT__=(.+?)<\/script>/)
    if (!match) {
        reject(new Error('Server retruend unexpected response'))
        return
    }

    const payload = new Function(`return ${match[1]}`)()
    return payload?.state?.search?.searchResultList ?? []
}

/**
 * 네이버 사전으로부터 자세한 단어 데이터를 가져옵니다
 * @param {string} collectionId 
 * @param {string} entryId 
 */
async function fetchEntry (serviceId, entryId) {
    const {response} = await fetch({
        url: `https://dict.naver.com/entryApi/platform/${serviceId}/entry?entryId=${entryId}`,
        responseType: 'json',
        headers: {
            'Referer': 'https://dict.naver.com',
            'User-Agent': '(Android)'
        }
    })

    return response?.entry
}

/**
 * 발음 재생 버튼 클릭 이벤트
 * @this {HTMLButtonElement}
 * @param {MouseEvent} e
 */
async function onPhoneticClick (e) {
    e.preventDefault()
    e.stopPropagation()

    // 캐시됐다면 즉시 재생하기
    if (this.dataset.url?.startsWith('blob:')) {
        $audio.src = this.dataset.url
        $audio.currentTime = 0
        $audio.play()
        return
    }

    // 이미 불러오는 중이면 무시하기
    if (this.dataset.url !== undefined) {
        return
    }

    this.dataset.url = ''

    const $entry = this.closest('article')
    const details = await fetchEntry($entry.dataset.service, $entry.dataset.id)
    const prons = [
        ...(details?.group?.prons ?? []),
        ...(details?.members?.flatMap(member => member.prons ?? []) ?? [])
    ]

    try {
        for (const pron of prons) {
            this.dataset.url = pron.male_pron_file || pron.female_pron_file
            if (!this.dataset.url) {
                continue
            }

            switch (pron.pron_type) {
                case 'none':    // ?
                case 'normal':  // ?
                case 'A':       // 미국식 영어
                case 'C':       // 미국식 영어
                case 'pron_A':  // 미국식 영어
                case 'E':       // 영국식 영어
                // case 'AU':      // 호주식 영어
                // case 'IN':      // 인도식 영어
                    break
                default:
                    continue
            }
            
            break
        }

        // 재생 가능한 음성 파일이 없다면 Google TTS로 만들기
        if (!this.dataset.url) {
            const params = new URLSearchParams({
                text: $entry
                    .querySelector('header a')
                    .textContent
                    .replaceAll(/\([^)]+\)|\[[^\]]+\]|[^\p{L}\p{P}]/gu, ''),
                lang: $entry.dataset.lang
            })

            this.dataset.url = `https://www.google.com/speech-api/v1/synthesize?${params.toString()}`
        }

        // 음성 파일 불러오기
        const {response} = await fetch({
            url: this.dataset.url,
            responseType: 'blob',
            anonymous: true
        })

        // 불러온 음성 파일 재생하기
        this.dataset.url = URL.createObjectURL(response)
        this.click()
    } catch (err) {
        console.error(err)
        $entry.append(createErrorElement(err))
    }
}

/**
 * 단어 요소 클릭 이벤트
 * @this {HTMLAnchorElement}
 * @param {MouseEvent} e
 */
function onWordClick (e) {
    const query = [...this.childNodes]
        .filter(x => !['SUP'].includes(x.nodeName))
        .map(x => x.textContent.trim())
        .join(' ')

    if (!query) {
        return
    }

    e.preventDefault()
    e.stopPropagation()

    const $entries = createEntries(query)
    const rect = e.target.getBoundingClientRect()
    $entries.style.left = `${window.scrollX + rect.left}px`
    $entries.style.top = `${window.scrollY + rect.bottom}px`
    $entries.click()
    document.body.append($entries)
}

/**
 * @this {HTMLDivElement}
 * @param {WheelEvent} e
 */
function onEntriesWheel (e) {
    if (!e.ctrlKey) {
        return
    }

    e.preventDefault()
    e.stopPropagation()

    const size = parseInt(this.style.fontSize, 10) || 14
    const offset = e.deltaY === 0 ? 0 : (e.deltaY > 0 ? -1 : 1)

    this.style.fontSize = `${size + offset}px`
}

/**
 * @this {HTMLDivElement}
 * @param {PointerEvent} e 
 */
function onEntriesPointerDown (e) {
    const rect = this.getBoundingClientRect()

    // Shadow DOM 처리
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const inDeadZone = x > rect.width - 20 ||y > rect.height - 20

    if (!e.ctrlKey && (inDeadZone || this !== e.target)) {
        return
    }

    if (!this.classList.contains('preserve')) {
        this.classList.add('preserve')
    }

    if (!this.classList.contains('dragging')) {
        this.classList.add('dragging')
    }

    const shiftX = e.clientX - rect.left
    const shiftY = e.clientY - rect.top

    // 최상위로 올리기
    document.body.append(this)

    /**
     * @this {HTMLDivElement}
     * @param {PointerEvent} e 
     */
    function onPointerMove (e) {
        if (e.buttons < 1) {
            if (this.classList.contains('dragging')) {
                this.classList.remove('dragging')
            }

            this.removeEventListener('pointermove', onPointerMove)
            return
        }

        const x = Math.max(0, e.pageX - shiftX)
        const y = Math.max(0, e.pageY - shiftY)

        this.style.left = `${x}px`
        this.style.top = `${y}px`
    }

    this.addEventListener('pointermove', onPointerMove)
}

/**
 * @this {HTMLDivElement}
 * @param {PointerEvent} e
 */
async function onEntriesClick (e) {
    e.preventDefault()
    e.stopPropagation()

    this.addEventListener('wheel', onEntriesWheel)
    this.addEventListener('pointerdown', onEntriesPointerDown)
    this.style.width = ''
    this.style.height = ''

    if (this.dataset.x && this.dataset.y) {
        this.style.left = `${this.dataset.x}px`
        this.style.top = `${this.dataset.y}px`
    }

    try {
        const entries = await fetchEntries(this.dataset.query)

        for (const entry of entries) {
            const $entry = document.createElement('section')
            $entry.dataset.type = entry.dicType ?? ''
            $entry.dataset.name = entry.dictName ?? ''

            entry.items
                .map(createItemElement)
                .filter($ => $)
                .forEach($ => $entry.append($))

            if ($entry.children.length > 0) {
                this.append($entry)
            }
        }

        for (const $anchor of this.querySelectorAll('a')) {
            $anchor.target = '_blank'
            if ($anchor.closest('header')) {
                continue
            }
            if ($anchor.href.includes('dict.naver.com')) {
                $anchor.addEventListener('click', onWordClick)
            }
        }

        if (!this.textContent) {
            this.textContent = '검색 결과가 없습니다.'
            return
        }
    } catch (err) {
        console.error(err)
        this.append(createErrorElement(err))
    } finally {
        const { width, height } = this.getBoundingClientRect()
        this.style.width = `${Math.min(400, width)}px`
        this.style.height = `${Math.min(250, height)}px`
    }
}

/**
 * 오류 메세지를 담은 요소를 만듭니다
 * @param {Error} err 
 */
function createErrorElement (err) {
    const $ = document.createElement('div')
    $.classList.add('ndic-error')
    $.textContent = err.message
    return $
}

/** 
 * @param {object} entry 
 */
function createItemElement (item) {
    if (!item.id || !item.entryName || !item.entryLang || !item.destinationLink) {
        return
    }

    // 오픈 사전 결과 제외하기
    if (item.isOpenDict && item.isOpenDict !== '0') {
        return
    }

    const $ = document.createElement('article')
    $.dataset.id = item.id
    $.innerHTML = `
        <header>
            <a target="_blank" href="${item.destinationLink}">${item.entryName}</a>
            <button>🗣</button>
        </header>
    `

    if (item.lang) {
        $.dataset.lang = item.lang
    }
    
    if (item.translateLang) {
        $.dataset.translateLang = item.translateLang
    }

    const $phone = $.querySelector('button')
    $phone.addEventListener('click', onPhoneticClick)

    const $means = document.createElement('ul')
    $.append($means)

    for (const mean of item.meanList ?? []) {
        const $mean = document.createElement('li')
        $means.append($mean)

        if (mean?.order) {
            $mean.dataset.order = mean.order
            $mean.innerHTML += `<span>${mean.order}.&nbsp;</span>`
        }

        $mean.innerHTML += `<span>${mean.mean}</span>`
    }

    return $
}

/**
 * @param {string} query 검색어
 */
function createEntries (query) {
    const $ = document.createElement('div')
    $.classList.add('ndic')
    $.dataset.query = query
    $.addEventListener('click', onEntriesClick, { once: true })
    return $
}

document.addEventListener('pointermove', e => {
    pointer.x = e.clientX
    pointer.y = e.clientY
})

document.addEventListener('pointerup', e => {
    // 현재 커서 아래에 있는 모든 단어 요소 가져오기
    const $oldEntries = document.elementsFromPoint(e.x, e.y)
        .map($ => $.closest('.ndic'))
        .filter($ => $);

    // 보존할 요소 제외하고 모두 제거하기
    [...document.querySelectorAll('.ndic:not(.preserve)')]
        .filter($ => !$oldEntries.includes($))
        .forEach($ => $.remove())

    const selection = window.getSelection()
    if (!selection) {
        return
    }

    const query = selection.toString().trim()
    if (!query || query.includes('\n')) {
        return
    }

    const $entries = createEntries(query)

    const rect = selection.getRangeAt(0).getBoundingClientRect()
    $entries.style.left = `${window.scrollX + rect.left}px`
    $entries.style.top = `${window.scrollY + rect.top + (rect.height / 2)}px`
    $entries.style.width = `${rect.width}px`
    $entries.style.height = `${rect.height / 2}px`

    $entries.dataset.x = window.scrollX + rect.left
    $entries.dataset.y = window.scrollY + rect.bottom
    $entries.dataset.width = rect.width
    $entries.dataset.height = rect.height

    document.body.append($entries)
})

document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') {
        return
    }

    const $entries = document
        .elementFromPoint(pointer.x, pointer.y)
        ?.closest('.ndic')

    if ($entries) {
        $entries.remove()
        e.preventDefault()
        e.stopPropagation()
    }
})
