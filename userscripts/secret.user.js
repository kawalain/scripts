// ==UserScript==
// @name        Secret Attachement
// @version     0.1.0-wip
// @namespace   secret_attachmenet
// @license     MIT
// @match       *://*/*
// @connect     catbox.moe
// @connect     files.catbox.moe
// @connect     fatbox.moe
// @connect     files.fatbox.moe
// @grant       GM_addStyle
// @grant       GM_xmlhttpRequest
// @top-level-await
// ==/UserScript==

/**
 * @param {object} details
 * @returns {Promise<object>}
 */
function fetch (details) {
    return new Promise((resolve, reject) => {
        GM_xmlhttpRequest({
            ...details,
            onabort: () => reject(new Error('Request aborted')),
            ontimeout: () => reject(new Error('Request timed out')),
            onerror: () => reject(new Error('Network error')),
            onload: resolve
        })
    })
}

/**
 * @param {string} filename 
 * @param {(e: object) => void} onProgress 
 * @returns {Promise<Blob>}
 */
async function fetchFile (filename, onProgress = null) {
    for (const endpoint of ['files.fatbox.moe', 'files.catbox.moe']) {
        const url = `https://${endpoint}/${filename}`
        try {
            const {response, status} = await fetch({
                url,
                responseType: 'blob',
                onProgress
            })

            if (status >= 200 && status < 300) {
                return response
            }

            console.error(url, new Error(`Unexpected response status code ${status}`))
        } catch (err) {
            console.error(url, err)
        }
    }

    throw new Error(`Unable to fetch file from multiple endpoints: ${filename}`)
}

/**
 * @param {CryptoKey} key
 * @param {string} type 
 * @param {Blob} blob
 */
async function decryptBlob (key, blob) {
    const decryptedBuffer = await crypto.subtle.decrypt(
        {name: 'AES-CTR', counter: new Uint8Array(16), length: 64},
        key,
        await blob.arrayBuffer()
    )

    return new Blob([decryptedBuffer], {type: blob.type})
}

/**
 * @param {BufferSource} source
 * @returns {Promise<Uint8Array>}
 */
async function sha256 (source, length = 32) {
    const digest = await crypto.subtle.digest('sha-256', source)
    return new Uint8Array(digest, 0, length)
}

/**
 * @param {any[]} arr1
 * @param {any[]} arr2
 * @returns {boolean}
 */
function arraysEquals (arr1, arr2) {
    if (!arr1 || !arr2) return false
    if (arr1.length !== arr2.length) return false
    for (let i = 0; i < arr1.length; ++i) 
        if (arr1[i] !== arr2[i]) return false
    return true
}

class Secret {
    constructor (chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz1234567890') {
        /** @type {string} */
        this.chars = chars

        /** @type {RegExp} */
        this.pattern = new RegExp(`^[${RegExp.escape(chars)}]+$`)
    }

    /**
     * @param {string} encodedText
     * @returns {Uint8Array}
     */
    decode (encodedText) {
        const length = BigInt(this.chars.length)

        let n = 0n
        for (let i = 0; i < encodedText.length; i++) {
            n = n * length + BigInt(this.chars.indexOf(encodedText[i]))
        }

        const byteCount = n === 0n ? 1 : (n.toString(2).length + 7) >>> 3
        const bytes = new Uint8Array(byteCount)
        for (let i = 0; i < byteCount; i++) {
            bytes[i] = Number(n & 0xFFn)
            n = n >> 8n
        }

        return bytes
    }

    /**
     * @param {string} encodedText
     * @returns {Promise<{ key: CryptoKey, filename: string }>}
     */
    async extract (encodedText) {
        if (!this.pattern.test(encodedText)) {
            throw new Error('Invalid character in requested text')
        }

        const bytes = this.decode(encodedText)
        const length = bytes?.length ?? 0
        if (length <= 4) {
            throw new Error(`Invalid content, expected size is > 4, got ${length}`)
        }

        const [data, hash] = [bytes.slice(0, -4), bytes.slice(-4)]
        const calculatedHash = await sha256(data, 4)
        if (!arraysEquals(hash, calculatedHash)) {
            throw new Error(`Checksum failed, expected ${hash}, got ${calculatedHash}`)
        }

        return {
            key: await crypto.subtle.importKey('raw', data.slice(0, 16), {name: 'AES-CTR'}, false, ['decrypt']),
            filename: new TextDecoder().decode(data.slice(16))
        }
    }
}

const selectors = {
    'article.post': element => {
        console.log(element)
    }
}

const observer = new MutationObserver(mutations => {
    for (const {type, addedNodes} of mutations) {
        if (type !== 'childList') {
            continue
        }
        
        for (const node of addedNodes) {
            if (!(node instanceof HTMLElement)) {
                continue
            }

            console.log(node)

            for (const [selector, callback] of Object.entries(selectors)) {
                if (node.matches(selector)) {
                    callback(node)
                }
            }
        }
    }
})

observer.observe(document, {childList: true, subtree: true})

// const {key, filename} = await new Secret().extract('...')
// const encryptedBlob = await fetchFile(filename)
// const decryptedBlob = await decryptBlob(key, encryptedBlob)

// const $img = document.createElement('img')
// $img.src = URL.createObjectURL(decryptedBlob)
// document.body.append($img)
