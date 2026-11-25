
자동완성 입력창에 "서울"을 치고 Enter를 눌렀습니다. 항목이 선택되고 입력창이 비워졌는데, 비워진 입력창에 "울"이 다시 나타납니다. 영어로 테스트할 때는 한 번도 본 적 없는 버그입니다.

디자인 시스템을 고를 때 보통 데모 화면을 봅니다. 버튼이 예쁜지, 다크 모드가 되는지, 컴포넌트가 몇 개인지. 그런데 실제로 서비스에 넣고 나서 문제가 되는 것은 화면에 안 보이는 부분입니다. 한글 조합 중 Enter, Tab으로 이동할 때의 포커스 링, 스크린 리더가 읽는 문장, 아랍어에서 뒤집히는 화살표, 멀미가 나는 애니메이션 같은 것들입니다.

Astryx는 Meta가 공개한 오픈소스 React 디자인 시스템입니다(MIT, 베타). 아래 내용은 Astryx v0.7.16(2026년 11월) 공식 저장소의 문서와 소스를 읽고, 이런 보이지 않는 품질을 저장소가 어떤 규칙으로 정해 두었고 무엇으로 검증하는지 확인한 것입니다. 베타라서 이후 버전에서 달라질 수 있습니다.

## 왜 보이지 않는 품질이 선택 기준이 되는가

보이는 품질은 나중에 고칠 수 있습니다. 색이 마음에 안 들면 토큰을 바꾸면 됩니다. 보이지 않는 품질은 컴포넌트 안쪽에 있어서 사용하는 쪽에서 고치기 어렵습니다.

Astryx 공식 블로그의 국제화 글에 좋은 사례가 있습니다. 공개 후 아랍어·쿠르드어 앱을 만들던 개발자가 "표 정렬 라벨, 페이지네이션, 달력의 월 이름이 영어로 박혀 있고 바꿀 방법이 없다"는 제안을 올렸습니다. 그 개발자가 할 수 있는 우회책은 단어 몇 개를 바꾸려고 컴포넌트를 포크하는 것뿐이었다고 합니다. 같은 글은 원인도 적어 두었습니다. Meta 사내 도구는 대부분 영어를 쓰는 직원에게 영어로 제공됐기 때문에 번역과 오른쪽에서 왼쪽으로 쓰는 언어(RTL) 지원이 우선순위가 아니었다는 것입니다. 8년 된 디자인 시스템이라도 써 본 적 없는 조건에서는 빠진 부분이 있었습니다.

그래서 여기서 볼 것은 규칙이 문서로 적혀 있는지, 그 규칙을 기계가 검사하는지, 아직 못 지킨 부분을 숨기지 않는지입니다. 저장소의 설계 문서는 지키지 못한 부분을 "gap"이라고 표시해 두는 편이라, 그 표시도 그대로 옮겨 적었습니다.

## 접근성: 컴포넌트가 기본으로 처리하는 것

### 패턴 계약으로 쓰는 접근성 명세

스위치 컴포넌트가 지켜야 할 것은 정해져 있습니다. 역할이 switch로 보고될 것, 상태가 바뀌어도 이름이 바뀌지 않을 것, 켜짐·꺼짐이 실제 화면과 일치할 것, 포인터와 키보드 양쪽으로 조작될 것, 상태가 바뀌어도 포커스가 그대로일 것.

이것을 컴포넌트마다 테스트로 다시 쓰면, 쓸 때마다 WCAG와 WAI-ARIA 작성 지침(APG)을 다시 해석하게 되고 해석이 조금씩 어긋납니다. `internal/a11y-spec`의 README는 그래서 패턴을 "데이터로 한 번" 쓰고 컴포넌트가 거기에 묶인다고 설명합니다. 패턴 목록에는 radio-group, checkbox, switch, button, text-input, modal-dialog, status-message, tabs, listbox, combobox, menu, tooltip, slider, tree-view, table 등이 있습니다. 이 패키지는 내부용이고 npm에 배포되지 않습니다.

눈여겨볼 것은 증거 계층(evidence layer)이라는 개념입니다. jsdom은 마크업을 그릴 뿐, 접근성 트리를 계산하거나 실제 Tab 순서를 따라가지 못합니다. 그래서 jsdom에서 확인할 수 없는 기대 항목은 통과로 치지 않고 `unrun`(실행 안 됨)으로 보고하고, 실제 Chromium에서 따로 증명합니다. "속성이 맞아 보이니 통과"라는 흔한 착각을 이렇게 막습니다.

결과에는 점수가 없습니다. README의 표현을 빌리면 필수 항목 하나가 실패한 패턴은 "대체로 적합"이 아닙니다. 한계도 적혀 있습니다. 이 계약은 스크린 리더가 실제로 무엇을 말하는지는 보고하지 않고, axe 검사나 시각 검사, 사람의 검토를 대신하지도 않습니다.

### 입력 방식 구분과 포커스 링

버튼을 마우스로 눌렀는데 굵은 포커스 링이 남아 있으면 거슬립니다. 반대로 키보드로 이동하는데 링이 안 보이면 어디에 있는지 알 수 없습니다.

`docs/architecture/interaction-modality.md`는 마지막 입력 방식(modality)을 하나의 공유 상태로 추적한다고 설명합니다. Meta, Alt, Control 없이 키를 누르면 `keyboard`, 마우스·터치·펜으로 누르면 `pointer`이고, 아무 입력도 없던 처음 상태는 처음 포커스가 보이도록 `keyboard`입니다. 코드가 `focus()`를 호출해 옮긴 포커스는 새 입력 방식을 만들지 않습니다. 직전에 포인터를 썼으면 링을 숨기고, 키보드를 썼으면 보여 줍니다. 다이얼로그를 닫고 원래 버튼으로 포커스를 돌려줄 때 링이 보일지 말지가 여기서 정해집니다. 브라우저의 `:focus-visible`만으로 구분할 수 없는 경우에 이 공유 상태를 함께 씁니다.

같은 문서에는 "모든 입력 방식에 조작 경로가 있어야 한다"는 규칙도 있습니다. 호버가 무언가를 발견하거나 실행하는 유일한 방법이면 안 됩니다.

포커스 링의 모양은 토큰 네 개로 정해집니다.

| 토큰 | Core 기본값 |
| --- | --- |
| `--focus-outline-width` | `2px` |
| `--focus-outline-style` | `solid` |
| `--focus-outline-color` | `var(--color-accent)` |
| `--focus-outline-offset` | `3px` |

링을 그리는 모든 컴포넌트가 이 토큰을 공유하므로, 테마에서 이 값을 바꾸면 시스템 전체의 포커스 표시가 함께 바뀝니다. 토큰과 테마는 [Astryx 테마와 디자인 토큰 (defineTheme, 다크 모드, 나만의 테마)](/blog/astryx-theme-tokens/)에서 다룹니다.

### 포커스 가능한 비활성 상태

"비활성 버튼에는 `disabled` 속성을 쓰는 것이 접근성에 맞다"는 흔한 오해가 있습니다. 네이티브 `disabled`는 컨트롤을 포커스 순서에서 뺍니다. 키보드 사용자는 그 버튼이 있는지조차 알 수 없고, 왜 못 누르는지 설명도 읽을 수 없습니다. 포커스를 잡고 있던 버튼이 비활성으로 바뀌면 포커스가 문서 본문으로 떨어져서 위치를 잃습니다.

AST-085 명세(focusable disabled)는 이 세 가지를 이유로 다른 방향을 택했습니다. 컴포넌트는 네이티브 `disabled` 속성을 렌더링하지 않고 `aria-disabled="true"`를 노출하며, 활성일 때의 포커스 순서를 그대로 유지합니다. 비활성 컨트롤은 포인터, 터치, Enter, Space, 입력, 붙여넣기, 드롭까지 포함해 값 변경, 실행, 이동, 콜백 호출을 모두 막습니다. 비활성 필드의 값은 네이티브 `disabled`와 마찬가지로 폼 제출에 포함되지 않습니다. 호버·누름 표시는 나타나지 않지만, 키보드로 이동했을 때 포커스 링은 보입니다.

사용하는 쪽의 API는 바뀌지 않습니다. 계속 `isDisabled`를 쓰면 됩니다. 다만 명세는 2026년 10월 21일에 승인됐고, 문서 안에 일부 컴포넌트와 테스트가 "적합화 대기 중"이라고 적혀 있습니다. 또 CSS에서 `:disabled`로 고르거나 테스트에서 `toBeDisabled()`를 쓰던 코드, Tab이 비활성 컨트롤을 건너뛴다고 가정한 코드는 영향을 받는다고 명세가 직접 경고합니다.

### 상태 알림

검색 결과가 12개에서 3개로 줄었습니다. 눈으로 보는 사람은 바로 알지만 스크린 리더 사용자는 누가 말해 주지 않으면 모릅니다.

여기에도 흔한 오해가 있습니다. "`aria-live` 속성을 붙인 `div`에 문장을 넣어 렌더링하면 읽어 준다." `useAnnounce` 문서는 대부분의 스크린 리더가 내용과 함께 삽입된 라이브 영역을 무시한다고 설명합니다. 라이브 영역은 비어 있는 채로 먼저 존재해야 하고, 그 뒤에 내용이 바뀌어야 읽힙니다.

AST-086 명세(status announcements)는 이를 규칙으로 만들었습니다. 메시지 하나에는 알림 주인이 정확히 하나여서, 같은 문장을 보여 주는 다른 요소는 `role="status"`나 `aria-live`를 갖지 않습니다. 두 번 읽히는 것을 막기 위해서입니다. 문서마다 공유 채널이 하나 있고, polite 영역과 assertive 영역이 빈 채로 만들어져 계속 붙어 있습니다. 오류와 시간이 급한 실패는 assertive, 나머지는 polite입니다. 상태 전환 한 번에 한 번만 알리며, 리렌더나 StrictMode의 재실행으로 반복되지 않습니다.

앱 코드에서는 `useAnnounce` 훅으로 이 채널을 씁니다.

```tsx
import {useEffect} from 'react';
import {useAnnounce} from '@astryxdesign/core/hooks';

function ResultCount({count}: {count: number}) {
  // 계속 바뀌는 값은 hasReplace 인스턴스로: 아직 읽히지 않은 이전 메시지를 대체한다
  const announce = useAnnounce({hasReplace: true});

  useEffect(() => {
    announce(`${count}개 결과`); // 기본값은 'polite'
  }, [announce, count]);

  return null;
}
```

문서의 권장 사항은 "상호작용이 아니라 결과를 알려라"입니다. "검색을 실행함"이 아니라 "12개 결과"입니다. 이미 화면에 보이고 라벨이 제대로 붙은 내용은 두 번 읽히므로 알리지 않습니다. 호출하는 컴포넌트가 열린 Astryx 모달 안에 있으면 메시지는 그 모달 안의 영역으로 전달됩니다. 네이티브 모달이 페이지 본문의 영역을 보조 기술에서 가리기 때문입니다.

### 오버레이 닫기 규칙

다이얼로그 안에서 드롭다운을 열고 Escape를 눌렀습니다. 드롭다운만 닫혀야 하는데 다이얼로그까지 닫히는 UI를 한 번쯤 봤을 겁니다.

`docs/families/overlay-dismissal.md`는 Dialog, Popover, DropdownMenu, Tooltip, HoverCard, BottomSheet, CommandPalette, ContextMenu, Drawer 등 닫을 수 있는 모든 층이 하나의 공유 스택에 참여해야 한다고 정합니다. 요청 하나는 표면 하나에만 영향을 줍니다. Escape는 맨 위에 등록된 표면 하나에만 전달되고 그 뒤로 넘어가지 않으며, 콘텐츠가 먼저 Escape를 처리했으면 공유 리스너는 물러납니다. 텍스트 조합은 층 닫기가 아니어서, 조합을 취소하려고 누른 Escape는 층을 닫지 않고 소비됩니다. 닫힌 뒤 포커스는 연 쪽 문서의 복귀 대상으로 돌아가고, 이때 페이지를 스크롤하지 않습니다. 배경을 눌러 닫는 동작은 누름이 배경에서 시작해서 배경에서 끝났을 때만 성립합니다. 다이얼로그 안에서 텍스트를 드래그하다가 바깥에서 손을 떼도 닫히지 않습니다.

조합 중 Escape 규칙은 한국어 사용자와 직접 관련된 내용이라 뒤의 IME 절에서 다시 다룹니다.

## 국제화

### 빠른 시작

국제화 기능은 `@astryxdesign/core`에 들어 있어 따로 설치할 것이 없습니다. 앱을 `InternationalizationProvider`로 감싸고 `locale`을 정하면 됩니다.

```tsx
import {InternationalizationProvider} from '@astryxdesign/core/i18n';
import koKR from '@astryxdesign/core/locales/ko-KR.generated.js';

function Root() {
  return (
    <InternationalizationProvider locale="ko-KR" messages={{'ko-KR': koKR}}>
      <App />
    </InternationalizationProvider>
  );
}
```

영어 카탈로그는 항상 내장돼 있고, 다른 언어는 `messages`로 넘깁니다. `locale`을 바꿔 다시 렌더링하면 새로고침 없이 문자열이 바뀝니다. 사용자의 선택을 어디에 저장할지(localStorage, 쿠키, URL)는 앱이 정합니다. 프로바이더 없이 써도 깨지지 않습니다. 설계 문서는 프로바이더 밖의 컴포넌트가 영어, `ltr`로 동작하고 브라우저의 언어 설정을 임의로 읽지 않는다고 정해 두었습니다.

### 번역 문자열과 로케일

여기서 번역되는 것은 Astryx가 가진 문자열뿐입니다. 닫기 버튼의 `aria-label`, 페이지네이션의 "다음 페이지로 이동", 선택 상자의 자리 표시 문구 같은 것들입니다. 제품의 문구는 앱의 몫입니다.

카탈로그는 두 가지 형태로 제공됩니다.

| 경로 | 내용 |
| --- | --- |
| `@astryxdesign/core/locales/<태그>.generated.js` | 키와 메시지만 담은 런타임용 문자열 맵 |
| `@astryxdesign/core/locales/<태그>.json` | 번역자를 위한 `description`까지 담은 원본 |

메시지 형식은 ICU MessageFormat입니다. 복수형을 코드에서 조립하지 않고 문자열이 직접 선언합니다.

```text
Go back {step, number} {step, plural, one {page} other {pages}}
```

한국어 카탈로그에서 같은 키는 `other` 하나만 씁니다. 한국어에는 수에 따른 형태 변화가 없기 때문입니다. 공식 블로그는 아랍어의 복수 형태가 여섯 가지, 러시아어와 폴란드어가 네 가지라는 점을 들어 `one`/`other` 가정이 통하지 않는다고 설명합니다.

키를 찾는 순서는 로케일별 재정의(`overrides`), 넘겨받은 카탈로그, 내장 영어 순이고, 각 단계에서 `pt-BR`은 `pt`로 한 번 올라갑니다. 번역이 빠진 키는 조용히 영어로 표시됩니다.

저장소에는 영어 외에 29개 로케일 파일이 있습니다. 공식 블로그에 따르면 이 번역은 LLM으로 초안을 만들고, ICU 파서로 구조를 검증하고, 다른 모델로 의미를 검토한 것입니다. 블로그는 이것이 출발점일 뿐이며 그 언어에 능숙한 사람이 더 잘할 것이라고 분명히 적었습니다.

한국어를 쓸 계획이라면 확인할 것이 있습니다. 이 글을 쓰는 시점의 main 브랜치에서 `en.json`의 키는 680개, `ko-KR.json`의 키는 365개였고, 빠진 키는 영어로 보입니다. 어색한 번역이나 빠진 문구는 `overrides`로 앱에서 바로 고칠 수 있고, Crowdin 프로젝트에 기여할 수도 있습니다.

```tsx
<InternationalizationProvider
  locale="ko-KR"
  messages={{'ko-KR': koKR}}
  overrides={{'ko-KR': {'@astryx.pagination.next': '다음'}}}>
  <App />
</InternationalizationProvider>
```

개발 중에는 `pseudo` 로케일이 쓸모 있습니다. 모든 문자열을 `⟦…⟧`로 감싸고 글자를 악센트 붙은 비슷한 글자로 바꿔서, 번역을 거치지 않은 문자열과 긴 문구에 깨지는 레이아웃을 드러냅니다.

### i18n 라이브러리 연동

이미 react-intl, i18next, next-intl, LinguiJS를 쓰고 있다면 바꿀 필요가 없습니다. 두 프로바이더(`IntlProvider`와 `InternationalizationProvider`)를 나란히 두고 같은 `locale`을 넘기면 됩니다. Astryx는 앱의 문자열을 보지 않고, 앱의 i18n 라이브러리는 Astryx 내부 문자열을 보지 않습니다. 공식 블로그는 기존 프레임워크를 통째로 채택하지 않은 이유를 번들 무게와 이미 다른 것을 표준으로 쓰는 팀과의 충돌로 설명합니다. 형식(ICU MessageFormat)만 표준을 따르고 런타임은 작게 유지했습니다.

외부 런타임 하나로 앱과 Astryx의 문자열을 모두 처리하는 어댑터는 아직 로드맵에 있습니다(이슈 #4029). 반대로 앱이 작다면 `useTranslator`로 앱 문자열까지 Astryx를 통해 처리할 수 있지만, 문서는 규모 있는 앱에는 전용 i18n 라이브러리를 권합니다. 서버 컴포넌트용 번역 런타임도 별도 결정으로 남아 있습니다. 현재의 번역 훅은 클라이언트 컨텍스트 API입니다.

### RTL과 양방향 처리

방향(`'ltr'` 또는 `'rtl'`)은 `locale`에서 `Intl.Locale.getTextInfo()`로 유도됩니다. `ar`, `he`, `fa`, `ur`을 넘기면 자동으로 `'rtl'`이 됩니다. 컴포넌트마다 할 일은 없습니다. 간격은 CSS 논리 속성으로 뒤집히고, 방향이 있는 아이콘은 제자리에서 반전되고, 좌우 화살표 키가 바뀌고, 오버레이가 올바른 쪽에 붙습니다.

직접 할 일은 하나입니다. Astryx는 DOM의 `dir` 속성을 대신 설정하지 않으므로 `<html>`에 직접 넣어야 하고, 서버 렌더링이라면 `getLocaleDirection()`을 씁니다.

```tsx
import {getLocaleDirection} from '@astryxdesign/core/i18n';

export default function RootLayout({children, params}) {
  const {locale} = params;
  return (
    <html lang={locale} dir={getLocaleDirection(locale)}>
      <body>{children}</body>
    </html>
  );
}
```

"논리 속성만 쓰면 RTL은 끝난다"는 것도 오해에 가깝습니다. 공식 블로그가 든 예입니다.

```css
inset-inline-start: 0;
transform: translateX(-50%);
```

두 줄 모두 따로 보면 문제가 없습니다. 그런데 논리적 시작 가장자리에 붙인 뒤 뒤집히지 않는 물리적 변환으로 밀기 때문에, RTL에서는 요소가 자기 너비만큼 엉뚱한 쪽에 놓입니다. 아이콘도 마찬가지입니다. JS에서 글리프를 바꾸고 CSS에서도 뒤집으면 두 번 뒤집혀 원래대로 돌아갑니다.

린트는 이런 조합 버그를 잡지 못합니다. 그래서 Astryx는 모든 컴포넌트 스토리를 양방향으로 렌더링해 위치를 비교하는 RTL 감사를 만들어 CI에서 돌립니다. `docs/architecture/rtl-audit-evidence.md`는 린트가 렌더링 증거를 대신할 수 없고, 전부 "해당 없음"으로 나온 보고서를 RTL 준비 완료로 쳐 주지 않는다고 분명히 적습니다.

`docs/design/bidirectionality.md`의 원칙도 알아 둘 만합니다. RTL은 모든 픽셀을 기계적으로 뒤집는 것이 아닙니다. 이전·다음을 뜻하는 화살표는 뒤집지만, 로고, 차트, 지도, 시계처럼 물리적 의미가 있는 것은 그대로 둡니다. 접근성 이름도 "왼쪽 화살표"가 아니라 "이전 달"처럼 의미로 붙입니다.

### 달력 체계

`Calendar`는 따로 정하지 않으면 그레고리력을 보여 줍니다. 로케일만으로는 달력이 바뀌지 않습니다. `fa-IR`을 넘겨도 페르시아어로 된 그레고리력이 나오고, `calendar="persian"`을 넘겨야 페르시아력이 됩니다.

```tsx
<InternationalizationProvider locale="fa-IR" calendar="persian">
  {/* 화면에는 Aban 1405, value와 onChange는 '2026-10-30' 그대로 */}
  <Calendar value={date} onChange={setDate} />
</InternationalizationProvider>
```

값은 어떤 달력에서도 그레고리력 ISO 날짜(`YYYY-MM-DD`)입니다. 데이터, 서버 코드, 기존 핸들러를 고칠 필요가 없게 한 설계입니다.

지원하는 달력은 그레고리력, 불기(`buddhist`), 민국 기년(`roc`), 일본 연호(`japanese`), 페르시아력, 인도 국정력, 히브리력, 히즈라력 3종, 중국 음력(`chinese`), 한국 음력(`dangi`), 콥트력, 에티오피아력입니다. 앞의 넷을 뺀 나머지는 런타임의 `Temporal`이 필요합니다. 문서 기준으로 Chrome과 Edge 144 이상, Firefox 139 이상, Node.js 26 이상이 `Temporal`을 제공하고 Safari는 아직 없습니다. 없는 환경에서는 `temporal-polyfill/full/global`을 서버와 브라우저 양쪽에서 불러와야 하고, 불러오지 않으면 그레고리력으로 표시됩니다.

음력에는 알아 둘 한계가 있습니다. 음력의 초하루는 천문 계산으로 정해지는데, 폴리필은 네이티브 `Temporal`과 몇몇 달의 시작이 하루 다릅니다. 문서는 1900~2100년 범위에서 폴리필이 중국 음력 9개 달, `dangi` 4개 달을 하루 다르게 시작한다고 적어 두었습니다. 서버와 브라우저의 구현이 다르면 하이드레이션 때 그 달이 다시 그려질 수 있습니다.

## IME 가드: 한글 조합 입력을 지키는 설계

처음의 "서울" 버그로 돌아갑니다. 한글, 일본어, 중국어는 입력기(IME)가 글자를 조합합니다. 조합 중에 Enter를 누르면 브라우저는 조합을 확정하기 위한 `keydown`을 `compositionend`보다 먼저 보냅니다. 평범한 핸들러는 `e.key === 'Enter'`만 보고 명령을 실행합니다. 항목을 선택하고 입력창을 비우면, 뒤이어 온 `compositionend`가 조합 중이던 글자를 방금 비운 입력창에 써 넣습니다. 이 현상 자체는 [한글을 치고 Enter를 누르면 왜 두 번 전송될까 (IME 조합과 isComposing)](/blog/korean-ime-enter-twice/)에서 따로 다뤘습니다.

Astryx는 이 문제를 `packages/core/src/utils/ime.ts`의 판별 함수 하나로 처리합니다.

```ts
const IME_PROCESSING_KEY_CODE = 229;

export function isImeKeyEvent(event: {
  isComposing?: boolean;
  keyCode?: number;
}): boolean {
  return (
    event.isComposing === true || event.keyCode === IME_PROCESSING_KEY_CODE
  );
}
```

신호를 두 개 보는 이유가 소스 주석에 적혀 있습니다. `isComposing`이 표준 신호이지만, 일부 IME와 오래된 Safari는 조합 중의 `keydown`을 `isComposing`이 아직 `true`가 아닌 채로 보내면서 `keyCode`는 229로 보고합니다. "`isComposing`만 보면 된다"는 생각이 오해인 이유입니다. 주석은 브라우저별 검증 없이 229 폴백을 빼지 말라고 당부합니다.

### 설계 메모에서 읽을 판단

저장소 루트의 `IME_GUARD_DESIGN.md`는 이 함수를 정리하던 때의 설계 메모입니다(배포되지 않는 검토용 문서입니다). 먼저 흩어진 가드를 하나로 모았습니다. 메모가 조사한 Core의 가드 지점은 일곱 곳입니다.

| 위치 | 지키는 키 |
| --- | --- |
| `useFocusTrap` | Escape(트랩 닫기) |
| `BaseTypeahead` | Enter, Escape, 화살표, Home, End |
| `PowerSearchEditPopover` | Enter(저장), Escape(취소) |
| `Dialog` | Escape(닫기) |
| `ContextMenu` | Escape(닫기) |
| `Tooltip` | Escape(닫기) |
| `ChatComposerInput` | Enter(전송) |

이 중 세 곳은 `isComposing || keyCode === 229`를 직접 풀어 쓰고 있었고, 함수 자체는 포커스 트랩 훅 안에 들어 있었습니다. 메모는 함수를 `utils/ime.ts`로 옮기고 모든 곳이 그 함수를 부르게 했습니다. 동작은 바뀌지 않았습니다.

래퍼 훅은 만들지 않았습니다. `useImeSafeKeyDown(handler)`처럼 조합 중에는 핸들러를 통째로 건너뛰는 훅이 깔끔해 보이지만, 메모는 이를 과한 설계로 보고 기각했습니다. 일곱 곳 중 네 곳은 React의 `onKeyDown`이 아니라 `useEffect` 안의 네이티브 리스너라서 훅으로 감쌀 수 없습니다. `useFocusTrap`과 `Dialog`는 IME 검사를 다른 조건과 함께 쓰기 때문에 통째로 건너뛰면 동작이 달라집니다. 핸들러 첫 줄의 `if (isImeKeyEvent(e)) return;`이 명시적이고, 검색하기 쉽고, 린트로 잡기 쉽다는 것이 메모의 판단입니다.

그리고 사람의 기억 대신 린트로 강제합니다. `internal/eslint-plugin-astryx/no-unguarded-ime-keydown.js`는 편집 가능한 요소(`textarea`, 텍스트를 받는 `input`, `contentEditable`, `role="textbox"`·`"searchbox"`·`"combobox"`)의 `onKeyDown`이 Enter, Escape, 화살표 같은 명령 키로 분기하면서 조합 가드가 없으면 경고합니다. 체크박스나 숫자 입력처럼 조합이 일어날 수 없는 타입은 제외합니다.

한계도 규칙 파일에 적혀 있습니다. 이 규칙은 `warn` 단계로 들어가 있고, 주석에 따르면 Selector와 MultiSelector가 아직 위반 상태라 별도 작업에서 고치는 중입니다. 경고가 너무 많으면 규칙이 꺼지기 쉬워서, 일부를 놓치더라도 느슨하게 검사하는 쪽을 택했다고도 적혀 있습니다. 공식 블로그 역시 잘림과 IME 비호환이라는 새 종류의 오류를 추적 중이라고 썼습니다. 한국어 서비스에 넣기 전에 검색, 자동완성, 채팅 입력처럼 Enter와 Escape를 쓰는 화면은 한글로 직접 쳐 보는 것이 좋습니다.

### 앱 코드에서 쓰기

앱에서 Astryx 입력 컴포넌트에 직접 `onKeyDown`을 붙일 때도 같은 함수를 쓸 수 있습니다. v0.6.0 코드모드가 이 함수의 import 경로를 `@astryxdesign/core/utils`로 옮긴 것으로 보아, 공개 경로는 다음과 같습니다.

```tsx
import {isImeKeyEvent} from '@astryxdesign/core/utils';

function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
  if (isImeKeyEvent(e.nativeEvent)) return; // 조합 중이면 명령으로 취급하지 않는다
  if (e.key === 'Enter') submit();
}
```

소스 주석은 React 핸들러에서 `e.nativeEvent`를 넘기기를 권합니다.

조합 보호는 닫기 규칙과도 이어져 있습니다. 앞에서 본 오버레이 닫기 계약의 FR6이 "조합을 취소하는 Escape는 층을 닫지 않는다"는 규칙입니다. 다이얼로그 안에서 한글을 치다가 조합을 취소하려고 Escape를 눌렀을 때 다이얼로그가 통째로 닫히지 않는 이유입니다.

## 모션

### 모션 토큰

지속 시간 토큰은 빠름, 중간, 느림 세 구간에 각각 세 개씩 아홉 개이고, 여기에 닫힘용 `--duration-exit`이 더해집니다.

| 구간 | 최소 | 기본 | 최대 |
| --- | --- | --- | --- |
| fast | `--duration-fast-min` 130ms | `--duration-fast` 175ms | `--duration-fast-max` 230ms |
| medium | `--duration-medium-min` 310ms | `--duration-medium` 410ms | `--duration-medium-max` 550ms |
| slow | `--duration-slow-min` 730ms | `--duration-slow` 975ms | `--duration-slow-max` 1300ms |

`--duration-exit`의 기본값은 `var(--duration-fast)`입니다.

이징 토큰은 네 개입니다. `--ease-standard`는 상태 변화, `--ease-entrance`는 나타나는 것, `--ease-move`는 화면 안에서 움직이는 것, `--ease-exit`은 사라지는 것에 씁니다. 앞의 셋은 감속 곡선이고 `--ease-exit`만 가속 곡선(`cubic-bezier(0.3, 0, 0.6, 0.6)`)입니다.

테마에서는 두 값으로 전체를 조절합니다.

```ts
export const brandTheme = defineTheme({
  name: 'brand',
  motion: {tempo: 0.85, character: 'crisp'},
});
```

`tempo`는 모든 지속 시간에 곱해지는 배율로 0.75에서 1.5 사이입니다. `character`는 `'crisp'`, `'standard'`, `'expressive'` 중 하나이고, `'expressive'`는 등장과 이동에서 살짝 넘쳤다가 돌아옵니다. 퇴장과 페이드는 넘치지 않습니다.

문서가 강조하는 것은 모션을 넣지 말아야 할 곳입니다. 표의 행 호버, 목록 항목 강조처럼 분당 수십 번 일어나는 상호작용에 눈에 띄는 지속 시간을 주면 화면이 커서를 뒤쫓는 것처럼 느껴집니다. 패널이 다 밀려 나올 때까지 안쪽을 누를 수 없다면 그 애니메이션은 방해가 됩니다.

### 퇴장 모션

AST-090 명세의 기본값은 예상과 다를 수 있습니다. 포인터 환경에서 다이얼로그와 층(Popover, Tooltip, DropdownMenu 등)의 퇴장 애니메이션은 기본으로 꺼져 있습니다. `--duration-exit-dialog`와 `--duration-exit-layer`의 기본값이 `0ms`이고, 테마가 0보다 큰 값을 주면 켜집니다.

켰을 때의 규칙은 꽤 자세합니다. 퇴장은 등장 경로를 되짚어서, 다이얼로그는 연 요소 쪽으로 줄어들며 사라집니다. 사라지는 중인 표면은 입력을 받지 않고, `onOpenChange(false)` 같은 콜백은 닫기를 요청한 시점에 호출됩니다. 사라지는 도중 다시 열면 깜빡임 없이 열린 상태로 돌아갑니다. 브라우저가 애니메이션 종료를 알리지 않아도 퇴장 시간이 지난 뒤 100ms 안에는 반드시 숨깁니다. 움직임 줄이기가 켜져 있으면 지속 시간과 상관없이 즉시 닫힙니다.

### 레이아웃 애니메이션

트리의 폴더를 펼치면 그 아래 내용이 한 번에 아래로 밀립니다. AST-105 명세는 이를 영역 단위의 선택 기능으로 풀었습니다.

```tsx
const scrollRef = useRef(null);
const animatedLayout = useAnimatedLayout({containerRef: scrollRef});

<ScrollableArea ref={scrollRef} label="Project">
  <TreeList items={items} animatedLayout={animatedLayout} />
  <p>Notes</p>
</ScrollableArea>;
```

`useAnimatedLayout`이 돌려주는 핸들을 크기가 바뀌는 컴포넌트의 `animatedLayout` prop에 넘기면, 바뀐 요소와 그 뒤의 내용이 같은 모션으로 함께 미끄러집니다. 뒤따르는 내용은 Astryx 컴포넌트가 아닌 평범한 요소여도 됩니다. 핸들을 넘기지 않으면 아무것도 달라지지 않습니다.

### 누름 피드백

버튼을 눌렀을 때 살짝 어두워지는 표시도 컴포넌트마다 따로 만들면 미묘하게 달라집니다. `docs/architecture/press-feedback.md`는 누름 상태를 쓰는 엔진을 하나로 두고, 표면마다 세 가지 방식(recipe) 중 하나를 쓰게 합니다. 순간 컨트롤(Button 계열, Link, Switch, Tab 등), 행 전체 대상(Item, TreeList 행, ClickableCard 등), 셀·메뉴 행(메뉴 행, 선택 옵션, CommandPalette 행)입니다.

터치는 스크롤 영역 밖에서는 즉시, 안에서는 150ms 뒤에 누름 표시를 시작합니다. 스크롤하려고 댄 손가락에 버튼이 반응해 번쩍이지 않게 하려고 기다리는 것입니다. 스크롤이 터치를 가져가면 누름 표시는 페이드 없이 끝납니다.

가장 중요한 불변식은 "누름은 칠하기만 한다"입니다. 누름 표시는 레이아웃, 크기, 터치 영역을 바꾸지 않습니다. 누르는 순간 대상이 움직여 탭이 빗나가는 일을 막습니다. 이 문서에는 gap 항목도 여럿 있습니다. Switch, Slider 등이 아직 고정 200ms로 해제되는 것, 마우스에서는 대부분의 표면이 아직 CSS `:active`로 칠하는 것 등이 미준수 항목으로 적혀 있습니다.

### 움직임 줄이기 대응

`docs/design/reduced-motion.md`(2026년 10월 24일 승인)의 규칙은 짧습니다.

- `prefers-reduced-motion: reduce`에서는 이동, 확대·축소, 크기 변화, 스프링이 없습니다.
- 주 포인터가 터치(`pointer: coarse`)이면 200ms 이하의 투명도 교차 페이드만 씁니다. iOS의 동작을 따른 것입니다.
- 그 밖의 포인터에서는 즉시 바뀝니다.
- 진행 막대의 길이처럼 제자리에서 바뀌는 값과 호버·선택 색은 어떤 포인터에서든 즉시 적용됩니다.
- Core 컴포넌트, prop, 테마 값 어디에도 이 규칙을 끄는 방법은 없습니다.

테마는 반대 방향으로만 조절할 수 있습니다. `reducedMotion: 'always'`는 사용자의 설정과 상관없이 모두에게 줄인 모션을 적용합니다.

흔한 오해는 "움직임 줄이기 = 애니메이션 전부 끄기"입니다. 문서의 표현은 "움직임을 없애되 정보는 없애지 않는다"입니다. 무언가 나타났고 사라졌다는 사실은 여전히 전달돼야 하고, 손가락이 직접 끄는 내용이 손가락을 따라가는 것은 전환이 아니라 직접 조작이라 그대로 둡니다. 앱의 자체 애니메이션도 `@media (prefers-reduced-motion: reduce)`로 같은 규칙을 따르라고 문서는 권합니다.

## 디자인 지침과 터치·모바일

### 디자인 지침 문서

`docs/design/`에는 사람이 정하는 시각적 의도를 적은 문서가 있습니다. 토큰 값이나 prop 문법이 아니라 "왜 그렇게 보여야 하는가"를 다룹니다. 아래 표에서 승인된(current) 문서는 모바일 타이포그래피, 사용자 상태, 양방향성, 움직임 줄이기이고 나머지는 초안(draft)입니다.

| 문서 | 핵심 |
| --- | --- |
| 타이포그래피 위계 | 글자 역할(제목, 본문, 라벨, 보조 텍스트, 코드)은 가까운 크기를 고르는 것이 아니라 기능에 맞는 역할을 써야 한다. 위계를 색에만 의존하지 않는다 |
| 모바일 타이포그래피 | 모바일의 읽기 기준 크기는 `max(데스크톱 기준, 16)`. 기본 적용 조건은 `(width < 1024px) and (pointer: coarse)`. 문서 루트의 글자 크기는 바꾸지 않는다 |
| 공간 위계 | 가까움이 관계를 말한다. 간격은 요소, 그룹, 섹션 순으로 커진다. 카드를 하나 더 두르기 전에 간격과 정렬로 묶는다 |
| 도형 관계 | 중첩된 표면의 안쪽·바깥쪽 모서리는 동심원처럼 평행하게 읽혀야 한다. 테두리 강조가 모서리와 충돌하지 않는다 |
| 컨트롤 리듬 | 한 줄에 놓인 서로 다른 컨트롤은 높이와 기준선이 맞아야 한다. 보이는 크기와 누를 수 있는 영역은 다른 문제다 |
| 아이콘 | 크기는 역할을 따른다(12, 16, 20, 24px 상당). 외곽선 아트워크가 기본. 색만으로 의미를 전달하지 않는다. 아이콘은 버튼, 터치 영역, 접근성 이름을 대신하지 못한다 |
| 시스템 상태 | 비활성, 로딩, 처리 중, 성공·경고·오류는 색과 함께 아이콘이나 라벨로 구분한다. 로딩 표시는 레이아웃을 밀지 않는다 |
| 사용자 상태 | 누르고 있는 표면에 `--color-overlay-pressed`를 칠한다. 비활성 컨트롤은 반응하지 않는다 |

모바일 타이포그래피에 16이라는 숫자가 나오는 이유는 문서 첫 줄에 있습니다. iOS의 터치 기기에서 입력창이 자동으로 갖는 16px 기준 최소 크기와 나머지 글자 크기의 균형을 맞추려는 것입니다.

실무 규칙은 `typography-best-practices` 문서에 더 직접적으로 나옵니다. 제목은 `Heading`, 나머지는 `Text`를 쓰고, `font-size`를 손으로 정하지 않습니다. 제목 단계를 건너뛰지 않으며(h1 다음 h3), 시각적 크기와 문서 구조가 다를 때는 `Heading`의 `accessibilityLevel`로 둘을 분리합니다.

아이콘은 `icon` prop에 의미 이름을 넘기거나 SVG 컴포넌트를 직접 넘깁니다. 테마의 `icons` 필드로 아이콘 세트를 통째로 바꿀 수 있습니다. 여러 아이콘 라이브러리를 세트로 등록하는 `astryx experimental icon` 명령은 v0.7.16 기준 실험 기능이고, 문서가 패치 릴리스에서도 예고 없이 바뀌거나 사라질 수 있다고 경고합니다.

### 터치 표현

AST-094 명세의 목표는 손가락으로 쓸 때 데스크톱 모션을 늘려 놓은 느낌이 아니라 네이티브처럼 느껴지게 하는 것입니다. 스프링과 제스처 임계값은 UIKit(문서 기준 iOS 26.2)에서 측정한 표 하나에서 나오고, Android에도 같은 동작을 적용합니다. 별도 설정 없이 터치 기기에서 기본으로 켜집니다.

사용하는 쪽이 알아 둘 규칙은 이렇습니다. 터치 표현은 주 포인터가 터치일 때, 그리고 하이드레이션이 끝난 뒤에만 적용되므로 서버 렌더링 결과는 포인터용 표현입니다. 기본 모양은 터치라고 상자를 키우지 않습니다. 대신 터치 영역이 보이지 않게 44×44px 쪽으로 넓어지고, 이웃 대상과 겹치지 않도록 간격의 절반에서 멈춥니다. 드래그로 실행되는 모든 동작은 드래그 없이 키보드와 마우스로도 할 수 있어야 합니다. 손가락 아래에서는 Selector, DropdownMenu, ContextMenu의 기본 표현이 달라지며, `presentation="popover"`로 이전 동작을 유지할 수 있습니다.

### BottomSheet

`BottomSheet`는 아래에서 올라오는 모바일용 시트입니다. 네이티브 `<dialog>`를 쓰고, 접근성 이름이 될 `label`이 필수입니다.

| prop | 값 | 뜻 |
| --- | --- | --- |
| `purpose` | `'info'` | Escape, 배경 누르기, 쓸어내리기로 닫힘 |
| | `'form'` | 입력한 내용을 보호. Escape로만 닫힘 |
| | `'required'` | 암묵적으로는 닫히지 않음. `role='alertdialog'` |
| `height` | `'hug'`, `'capped'`, `'tall'`, 숫자, CSS 길이 | 내용에 맞춤(뷰포트의 92%까지), 중간 높이(약 62%), 거의 전체(약 92%) |
| `snapPoints` | 숫자 또는 문자열 배열 | 드래그로 멈출 수 있는 추가 높이 |

`isOpen`과 `onOpenChange`로 완전히 제어합니다. `purpose`의 세 값이 Dialog와 같다는 점이 눈에 띕니다. 닫기 정책을 표면의 종류가 아니라 내용의 목적으로 정했습니다.

### 모바일 키보드

화면 키보드가 올라오면서 입력창을 가리거나 페이지가 휙 밀리는 것은 모바일 웹의 오래된 문제입니다. AST-099 명세는 키보드에 반응하는 모든 컴포넌트가 같은 방식으로 키보드 높이를 잰다고 정합니다. 레이아웃 뷰포트 높이에서 시각 뷰포트 높이에 배율을 곱한 값을 뺀 것입니다. 이 값은 공개 CSS 변수나 prop으로 노출되지 않습니다.

브라우저 지원 문서에 따르면 현재 이 처리를 하는 것은 완전히 펼친 `height='tall'` BottomSheet와 ChatLayout의 입력 영역입니다. Chrome on Android는 앱의 뷰포트 설정을 따르는데, Astryx는 뷰포트 `<meta>`를 앱의 것으로 보고 건드리지 않습니다. 키보드가 페이지를 덮는 대신 레이아웃을 줄이게 하려면 뷰포트 `content`에 `interactive-widget=resizes-content`를 더합니다.

## 긴 목록과 브라우저 지원 범위

### 긴 목록 가상화

행이 만 개인 표를 전부 그리면 느립니다. 보이는 부분만 그리는 기법의 원리는 [행 1만 개짜리 목록은 왜 버벅일까 (가상 스크롤)](/blog/virtual-list/)에서 다뤘고, 여기서는 Astryx의 현재 상태만 봅니다.

`docs/architecture/list-windowing.md`(2026년 11월 6일 결정)는 Core 안에 윈도잉 구현을 하나만 두기로 했습니다. 모듈은 `packages/core/src/virtualization/`에 있고 공개 API가 아닙니다. 공개 훅으로 낼지는 아직 열린 질문입니다.

지금 이 모듈을 쓰는 것은 Table뿐입니다. 문서는 Selector가 열릴 때 모든 옵션을, Chat이 모든 메시지를 렌더링한다고 현재 상태를 적어 두었고, 둘은 앞으로 이 모듈을 쓸 대상입니다. Selector에 옵션이 수천 개라면 지금은 서버 검색으로 후보를 줄이는 쪽이 현실적입니다.

Table의 행 가상화는 공개된 훅으로 켭니다.

```tsx
import {Table, useTableRowsVirtualization} from '@astryxdesign/core/Table';
import {VStack} from '@astryxdesign/core/Layout';

function ProductTable() {
  const virtualization = useTableRowsVirtualization({
    rowHeight: 56,
    initialViewportHeight: 320,
  });

  return (
    <VStack height={320}>
      <Table data={products} columns={columns} idKey="id" virtualization={virtualization} />
    </VStack>
  );
}
```

조건이 있습니다. 행 높이가 고정이어야 하고, Table의 부모에 높이가 있어야 합니다. 높이가 없으면 모든 행이 렌더링됩니다. `initialViewportHeight`는 서버와 첫 프레임의 계산에만 쓰이고 Table의 크기를 정하지는 않습니다. 줄바꿈이 있는 내용이나 높이가 제각각인 행은 지원 범위 밖이라 전체 렌더링으로 돌아갑니다.

### 브라우저 지원 범위

Astryx는 Popover API, CSS 앵커 포지셔닝, CSS `light-dark()` 위에 만들어졌습니다. 의존성을 줄이고 컴포넌트를 작게 유지하는 대신 브라우저 하한이 생깁니다.

문서는 버전 하나로 선을 긋지 않습니다. 트래픽은 디자인 시스템이 아니라 그 위에 만든 제품에 있기 때문이라는 설명입니다. 대신 단계를 정의하고 결정을 사용하는 쪽에 넘깁니다.

| 단계 | 대표 버전 | 사용자가 겪는 것 |
| --- | --- | --- |
| Tier 1 완전 지원 | Chrome 125+, Edge 125+, Safari 26+, Firefox 147+ | 앵커 포지셔닝을 포함해 전부 동작 |
| Tier 2 기능 지원 | Chrome 114+, Edge 114+, Safari 17+, Firefox 125+ | 열고 닫기는 정상. 툴팁, 메뉴, 팝오버가 트리거 옆에 놓이지 않을 수 있음 |
| Tier 3 | 그보다 오래된 것 | 깨지지 않는 것만 보장. `light-dark()`가 없어 테마 색이 기본값으로 돌아갈 수 있음 |

공식 지원은 Tier 1과 2입니다. 영향을 받는 것은 메뉴, 팝오버, 툴팁, 드롭다운을 여는 컴포넌트입니다(Tooltip, DropdownMenu, Selector, Typeahead, DateInput 등). 이런 층을 쓰지 않는 제품이라면 `light-dark()`만 있으면 됩니다. 그레고리력이 아닌 달력을 쓴다면 Safari에는 `Temporal`이 없어 앞에서 본 폴리필도 필요합니다.

Tier 2 사용자에게 정확한 위치가 필요하면 문서가 제시하는 선택지는 세 가지입니다. 앵커 포지셔닝 폴리필을 `@supports` 뒤에 조건부로 불러오거나, JS 위치 계산으로 대체하거나, 위치가 어긋나는 것을 받아들이는 것입니다. 어느 쪽이든 사용자 에이전트 문자열이 아니라 `CSS.supports('anchor-name', '--x')` 같은 기능 감지로 판단하라고 합니다.

한국 서비스라면 구형 iOS Safari 사용자 비중을 먼저 확인해 보는 것이 좋습니다. 표의 버전은 저장소 문서에 적힌 값이고, 각 기능의 브라우저별 지원 현황은 MDN에서 다시 확인하기를 권합니다.

## 테스트 체계와 진행 중인 영역

### 컴포넌트 테스트 충분성 기준

"테스트가 충분한가"는 보통 커버리지 숫자로 답합니다. `docs/architecture/component-test-sufficiency.md`는 다르게 답합니다. 테스트의 수는 공개 prop의 수나 소스 분기의 수가 아니라 서로 다른 동작과 위험의 수를 따릅니다. 고쳐진 결함은 회귀 테스트로 계속 보호하고, 그 테스트는 고치기 전에 실패하고 고친 뒤에 통과해야 합니다. 테스트는 내부 호출 순서나 내부 상태 모양이 아니라 공개 동작, 렌더링된 결과, 접근성 의미를 단언합니다.

약속한 동작을 제거하거나 뒤집었을 때 실패해야 충분한 테스트로 칩니다. 구현을 다시 계산해 비교하거나 상수를 자기 자신과 비교하는 단언은 증거가 아닙니다. 같은 구획의 반복 사례, 방어적인 전수 조합, 신호 없는 스냅샷 더미는 요구하지도 인정하지도 않습니다.

"어느 계층에서 관찰할 수 있는가"를 고르는 단계도 있습니다. 컴파일 타임, 단위·DOM, 브라우저 동작, 렌더링된 픽셀, 접근성 트리, 실제 보조 기술 중에서 실패를 볼 수 있는 계층을 택합니다. 앞에서 본 a11y-spec의 증거 계층과 같은 생각입니다.

### 시각 회귀와 상호작용 테스트

시각 회귀는 Storybook 기반입니다. `.github/scripts/visual-gate/README.md`에 따르면 안정 Core 컴포넌트는 대표 스토리와 `visual-baseline` 태그가 붙은 스토리를 기준 이미지와 비교하고, `visual-theme-matrix` 태그는 그 스토리를 승인된 모든 테마에서 찍습니다. 풀 리퀘스트에서는 기본으로 손댄 컴포넌트만 비교하고, 전체 검사는 main 병합 뒤와 릴리스 전에 돕니다. canary 전용 패키지에는 안정 시각 기준이 없습니다.

상호작용 테스트는 `internal/interaction-harness`가 맡습니다. Playwright로 휴대폰 크기의 터치 화면에서 Chromium과 WebKit 양쪽에 실제 터치 입력을 넣고, 프레임 증거와 곡선 샘플을 남깁니다. 터치 명세의 "메인 스레드가 바빠도 모션이 화면 주사율로 돈다" 같은 주장을 이것으로 증명합니다. 이 도구들은 모두 내부용이지만, 쓰려는 컴포넌트가 어떤 검사를 통과해 나오는지 알려 줍니다.

### 진행 중인 영역

| 영역 | 패키지 | v0.7.16 기준 상태 |
| --- | --- | --- |
| 리치 텍스트 | `@astryxdesign/richtext` | 안정. 공식 블로그(2026-10-20)에 따르면 v0.7.1부터 Core와 같은 버전으로 설치 |
| 차트 | `@astryxdesign/charts` | canary 전용. d3 기반 설정 모델. README에 "활발히 개발 중"이며 API와 모양이 다듬어지는 중이라고 적힘 |
| Vega 래퍼 | `@astryxdesign/vega` | canary 전용. Vega와 Vega-Lite 명세를 렌더링 |
| 네이티브 | `@astryxdesign/native` | 실험, canary 전용. README에 운영 앱에는 지원하지 않는다고 적힘 |

리치 텍스트는 Lexical 위에 만든 라벨 달린 폼 필드입니다. `RichTextEditor`와 읽기 전용 `RichTextView`가 있고, Markdown을 손실 없이 양방향으로 변환합니다. Lexical은 번들하지 않고 peer 의존성(`^0.52.0`)으로 직접 설치합니다. 접근성 면에서는 툴바 전체가 키보드로 동작하고, Tab은 들여쓰기를 하되 Escape 다음 Tab으로 편집기를 빠져나갑니다.

네이티브 쪽은 아직 방향을 정하는 단계입니다. `@astryxdesign/native`의 README는 플랫폼별로 여러 구현 방식을 같은 채점표로 비교하는 실험이라고 설명하고, Swift 바인딩 일부가 있으며 React Native와 Android 바인딩은 아직 만들어지지 않았다고 적습니다. React Native용 `@astryxdesign/react-native`를 다루는 AST-112 명세도 초안(draft)입니다. 지금 Astryx로 모바일 앱을 계획할 근거는 저장소에 없습니다.

저장소가 gap으로 적어 둔 항목들은 베타라는 사실과 함께, 도입 전에 내 서비스의 조건(한글 입력, 구형 Safari, 긴 목록)으로 직접 확인할 것이 무엇인지 알려 주는 목록이기도 합니다. 다음 편 [이 블로그에 Astryx를 적용한다면 (도입 판단과 단계별 계획)](/blog/astryx-on-this-blog/)에서는 이런 조건들을 실제 도입 판단에 대입해 봅니다.

## 참고

접근성

- [internal/a11y-spec/README.md](https://github.com/meta/astryx/blob/main/internal/a11y-spec/README.md)
- [docs/architecture/interaction-modality.md](https://github.com/meta/astryx/blob/main/docs/architecture/interaction-modality.md)
- [packages/cli/assets/docs/tree/tokens-focus.doc.mjs](https://github.com/meta/astryx/blob/main/packages/cli/assets/docs/tree/tokens-focus.doc.mjs)
- [docs/specs/AST-085-focusable-disabled/spec.md](https://github.com/meta/astryx/blob/main/docs/specs/AST-085-focusable-disabled/spec.md)
- [docs/specs/AST-086-status-announcements/spec.md](https://github.com/meta/astryx/blob/main/docs/specs/AST-086-status-announcements/spec.md)
- [packages/core/src/hooks/useAnnounce.doc.mjs](https://github.com/meta/astryx/blob/main/packages/core/src/hooks/useAnnounce.doc.mjs)
- [docs/families/overlay-dismissal.md](https://github.com/meta/astryx/blob/main/docs/families/overlay-dismissal.md)

국제화와 IME

- [공식 블로그: Astryx now speaks multiple languages!](https://github.com/meta/astryx/blob/main/apps/docsite/src/content/blog/posts/internationalizing-astryx.md)
- [docs/architecture/internationalization.md](https://github.com/meta/astryx/blob/main/docs/architecture/internationalization.md)
- [packages/cli/assets/docs/tree/internationalization.doc.mjs](https://github.com/meta/astryx/blob/main/packages/cli/assets/docs/tree/internationalization.doc.mjs)
- [packages/cli/assets/docs/tree/i18n-quick-start.doc.mjs](https://github.com/meta/astryx/blob/main/packages/cli/assets/docs/tree/i18n-quick-start.doc.mjs)
- [packages/cli/assets/docs/tree/i18n-library-integration.doc.mjs](https://github.com/meta/astryx/blob/main/packages/cli/assets/docs/tree/i18n-library-integration.doc.mjs)
- [packages/cli/assets/docs/tree/i18n-rtl-and-testing.doc.mjs](https://github.com/meta/astryx/blob/main/packages/cli/assets/docs/tree/i18n-rtl-and-testing.doc.mjs)
- [packages/cli/assets/docs/tree/i18n-calendars.doc.mjs](https://github.com/meta/astryx/blob/main/packages/cli/assets/docs/tree/i18n-calendars.doc.mjs)
- [packages/cli/assets/docs/tree/calendar-systems.doc.mjs](https://github.com/meta/astryx/blob/main/packages/cli/assets/docs/tree/calendar-systems.doc.mjs)
- [docs/specs/AST-111-calendar-systems/spec.md](https://github.com/meta/astryx/blob/main/docs/specs/AST-111-calendar-systems/spec.md)
- [packages/core/src/i18n/InternationalizationProvider.doc.mjs](https://github.com/meta/astryx/blob/main/packages/core/src/i18n/InternationalizationProvider.doc.mjs)
- [packages/core/locales/en.json](https://github.com/meta/astryx/blob/main/packages/core/locales/en.json), [ko-KR.json](https://github.com/meta/astryx/blob/main/packages/core/locales/ko-KR.json)
- [docs/design/bidirectionality.md](https://github.com/meta/astryx/blob/main/docs/design/bidirectionality.md)
- [docs/architecture/rtl-audit-evidence.md](https://github.com/meta/astryx/blob/main/docs/architecture/rtl-audit-evidence.md)
- [IME_GUARD_DESIGN.md](https://github.com/meta/astryx/blob/main/IME_GUARD_DESIGN.md)
- [packages/core/src/utils/ime.ts](https://github.com/meta/astryx/blob/main/packages/core/src/utils/ime.ts)
- [internal/eslint-plugin-astryx/no-unguarded-ime-keydown.js](https://github.com/meta/astryx/blob/main/internal/eslint-plugin-astryx/no-unguarded-ime-keydown.js)
- [packages/cli/assets/codemods/transforms/v0.6.0/move-ime-helper-import.mjs](https://github.com/meta/astryx/blob/main/packages/cli/assets/codemods/transforms/v0.6.0/move-ime-helper-import.mjs)

모션

- [packages/cli/assets/docs/motion.doc.mjs](https://github.com/meta/astryx/blob/main/packages/cli/assets/docs/motion.doc.mjs)
- [packages/cli/assets/docs/tree/tokens-duration.doc.mjs](https://github.com/meta/astryx/blob/main/packages/cli/assets/docs/tree/tokens-duration.doc.mjs), [tokens-ease.doc.mjs](https://github.com/meta/astryx/blob/main/packages/cli/assets/docs/tree/tokens-ease.doc.mjs)
- [docs/design/motion.md](https://github.com/meta/astryx/blob/main/docs/design/motion.md)
- [docs/design/reduced-motion.md](https://github.com/meta/astryx/blob/main/docs/design/reduced-motion.md)
- [docs/specs/AST-090-exit-motion/spec.md](https://github.com/meta/astryx/blob/main/docs/specs/AST-090-exit-motion/spec.md)
- [docs/specs/AST-105-animated-layout/spec.md](https://github.com/meta/astryx/blob/main/docs/specs/AST-105-animated-layout/spec.md)
- [docs/architecture/press-feedback.md](https://github.com/meta/astryx/blob/main/docs/architecture/press-feedback.md)

디자인 지침

- [docs/design/README.md](https://github.com/meta/astryx/blob/main/docs/design/README.md)
- [docs/design/typography-hierarchy.md](https://github.com/meta/astryx/blob/main/docs/design/typography-hierarchy.md)
- [docs/design/mobile-typography.md](https://github.com/meta/astryx/blob/main/docs/design/mobile-typography.md)
- [docs/design/spatial-hierarchy.md](https://github.com/meta/astryx/blob/main/docs/design/spatial-hierarchy.md)
- [docs/design/shape-relationships.md](https://github.com/meta/astryx/blob/main/docs/design/shape-relationships.md)
- [docs/design/control-rhythm.md](https://github.com/meta/astryx/blob/main/docs/design/control-rhythm.md)
- [docs/design/iconography.md](https://github.com/meta/astryx/blob/main/docs/design/iconography.md)
- [docs/design/system-states.md](https://github.com/meta/astryx/blob/main/docs/design/system-states.md)
- [docs/design/user-states.md](https://github.com/meta/astryx/blob/main/docs/design/user-states.md)
- [packages/cli/assets/docs/tree/typography-best-practices.doc.mjs](https://github.com/meta/astryx/blob/main/packages/cli/assets/docs/tree/typography-best-practices.doc.mjs)
- [packages/cli/assets/docs/icons.doc.mjs](https://github.com/meta/astryx/blob/main/packages/cli/assets/docs/icons.doc.mjs)
- [packages/cli/assets/docs/tree/icon-sets.doc.mjs](https://github.com/meta/astryx/blob/main/packages/cli/assets/docs/tree/icon-sets.doc.mjs)

터치, 목록, 브라우저, 테스트

- [docs/specs/AST-094-touch-presentations/spec.md](https://github.com/meta/astryx/blob/main/docs/specs/AST-094-touch-presentations/spec.md)
- [docs/specs/AST-099-mobile-keyboard/spec.md](https://github.com/meta/astryx/blob/main/docs/specs/AST-099-mobile-keyboard/spec.md)
- [packages/core/src/BottomSheet/BottomSheet.doc.mjs](https://github.com/meta/astryx/blob/main/packages/core/src/BottomSheet/BottomSheet.doc.mjs)
- [docs/architecture/list-windowing.md](https://github.com/meta/astryx/blob/main/docs/architecture/list-windowing.md)
- [packages/core/src/Table/useTableRowsVirtualization.doc.mjs](https://github.com/meta/astryx/blob/main/packages/core/src/Table/useTableRowsVirtualization.doc.mjs)
- [packages/cli/assets/docs/browser-support.doc.mjs](https://github.com/meta/astryx/blob/main/packages/cli/assets/docs/browser-support.doc.mjs)
- [docs/architecture/component-test-sufficiency.md](https://github.com/meta/astryx/blob/main/docs/architecture/component-test-sufficiency.md)
- [.github/scripts/visual-gate/README.md](https://github.com/meta/astryx/blob/main/.github/scripts/visual-gate/README.md)
- [internal/interaction-harness/README.md](https://github.com/meta/astryx/blob/main/internal/interaction-harness/README.md)

진행 중인 영역

- [공식 블로그: Introducing Astryx RichText](https://github.com/meta/astryx/blob/main/apps/docsite/src/content/blog/posts/introducing-astryx-richtext.md)
- [packages/charts/README.md](https://github.com/meta/astryx/blob/main/packages/charts/README.md)
- [packages/vega/README.md](https://github.com/meta/astryx/blob/main/packages/vega/README.md)
- [packages/native/README.md](https://github.com/meta/astryx/blob/main/packages/native/README.md)
- [docs/specs/AST-112-react-native-foundation/spec.md](https://github.com/meta/astryx/blob/main/docs/specs/AST-112-react-native-foundation/spec.md)
