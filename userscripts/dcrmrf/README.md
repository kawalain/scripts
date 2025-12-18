`dcrmrf.user.js`
---

<img width="200" alt="9dcff039-6fc9-440c-83fa-e50d0440a62a" src="https://github.com/user-attachments/assets/9bf81cfc-0c8b-4657-9e8b-2c051da2c556" />
<br><br>

- [Greasy Fork](https://greasyfork.org/en/scripts/530031-dcrmrf)
- [GitHub](https://github.com/kawalain/scripts/tree/main/userscripts/dcrmrf)
- [이전 Gist](https://gist.github.com/kawalain/183e05071873ab95bc2ad9f63e1c0f63)
- 버그/기능 문의: 디스코드 @kawalain

`dcrmrf.user.js` 는 디시인사이드에 작성된 글과 댓글을 자동으로 모두 지워주는 유저스크립트입니다.  


## 설치
1. 유저스크립트를 사용할 수 있는 확장 프로그램을 설치합니다.  
    - **파이어폭스**: [Violentmonkey](https://addons.mozilla.org/firefox/addon/violentmonkey) / [Tampermonkey](https://addons.mozilla.org/en-US/firefox/addon/tampermonkey)
    - **크롬**: [Tampermonkey](https://chromewebstore.google.com/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo) (**자주 묻는 질문** 항목 참고)
1. [여기를 눌러 유저스크립트를 설치](https://update.greasyfork.org/scripts/530031/dcrmrf.user.js)합니다.
1. [갤로그](https://gallog.dcinside.com)의 게시글 또는 댓글 페이지에서 클리너를 실행할 수 있습니다.


## 자주 묻는 질문

- **크롬에서 작동하지 않아요**  
  크롬의 [새 정책](https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3)으로 확장기능 대부분이 망가졌습니다.  
  아래 방법을 통해 우회할 수 있지만 작동을 보장하진 않으므로 [파이어폭스](https://www.mozilla.org/ko/firefox) 이전을 추천합니다. 
  1. [Tampermonkey](https://chromewebstore.google.com/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo) 확장기능 설치
  2. [유저스크립트 설치](https://update.greasyfork.org/scripts/530031/dcrmrf.user.js)
  3. 주소창에 `chrome://extensions` 입력해 확장 프로그램 페이지 열기
  4. 좌측 상단의 *개발자 모드* 활성화

- **특정 갤러리에 올려진 글이나 댓글을 삭제할 수 없어요**  
  디시인사이드 내부 버그로 가끔 갤로그에 갤러리 목록이 갱신되지 않을 수 있습니다.  
  문제 있는 해당 갤러리에 글이나 댓글 하나를 작성하고 클리너를 다시 실행해주세요.

- **유동으로 쓴 글과 댓글도 지울 수 있나요?**  
  지원하지 않습니다.
  
- **폰으로 실행할 수 있나요?**  
  확장기능 설치를 지원하는 브라우저(파이어폭스 등)에 확장기능과 스크립트를 설치하고  
  데스크탑 모드로 갤로그 페이지를 열면 실행할 수 있습니다.
  
- **프록시를 사용할 수 있나요?**  
  사용자 별로 봇 감지가 적용되므로 IP 변경은 의미가 없는걸로 알고 있습니다.
  
- **더 빠르게 지울 수는 없나요?**  
  한 번에 여러 요청을 보내면 캡챠가 쉽게 발생해 작업 속도가 더 느려질 수 있습니다.  
  취약점이 존재하지 않는 이상 1초에 한 개 삭제가 최선이라고 생각합니다.

- **컴퓨터(브라우저)를 계속 켜둬야하나요?**  
  네


## 기능
### 캡챠 풀이
아래의 **유료** 캡챠 풀이 서비스를 지원합니다.  
사용하지 않아도 클리너는 사용할 수 있지만 수동으로 풀어야 작업을 재개할 수 있습니다.  
여러 서비스의 API 키를 모두 입력하면 번갈아 사용합니다.

- [AntiCaptcha](https://anti-captcha.com/)
- [2Captcha](https://2captcha.com/)


### TODO
- 중간 보고 등 디스코드 웹훅으로 작업 현황 메세지 보내기
- 삭제 전 글이나 댓글 내용 백업한 뒤 내보내기
