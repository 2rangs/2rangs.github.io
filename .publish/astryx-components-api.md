
새 디자인 시스템을 처음 쓸 때 가장 자주 하는 일은 추측입니다. 비활성화는 `disabled`일까 `isDisabled`일까, 값이 바뀔 때는 이벤트 객체가 올까 값이 올까, 모달을 닫는 콜백은 `onClose`일까 `onOpenChange`일까. 컴포넌트가 열 개면 문서를 다 읽으면 되지만 150개가 넘으면 그럴 수 없어서, 큰 디자인 시스템에서는 컴포넌트 하나하나보다 모든 컴포넌트가 따르는 규칙이 더 중요해집니다.

Meta가 공개한 오픈소스 React 디자인 시스템 Astryx의 컴포넌트를 하나씩 나열하는 대신, 전체를 한 장의 지도로 보고 그 위에 깔린 API 관례를 정리했습니다. 관례를 알면 처음 보는 컴포넌트의 prop도 절반쯤은 맞힐 수 있습니다. 기준은 Astryx v0.7.16(2026년 11월) 공식 저장소의 문서와 소스이고, 베타라서 이후 버전에서는 달라질 수 있습니다.

## 컴포넌트 지도와 import 경로

Astryx의 컴포넌트 소스는 `packages/core/src` 아래에 컴포넌트 이름과 같은 폴더로 들어 있습니다. 각 폴더에는 구현(`*.tsx`)과 함께 문서 파일(`*.doc.mjs`)이 있고, 이 문서 파일에 `category`와 `group`이 적혀 있습니다. `astryx component --list`가 보여 주는 목록도 이 범주로 묶입니다.

아래 표는 2026년 11월 main 브랜치의 문서 파일에서 `category` 값을 직접 모아 만든 것입니다. 하위 컴포넌트(예: `DialogHeader`, `TableRow`)와 훅은 뺐고, 대표 이름만 적었습니다.

| 범주(category) | 용도 | 컴포넌트 |
| --- | --- | --- |
| Action | 누르면 무언가 일어나는 것 | Button, IconButton, ToggleButton, ButtonGroup, Link, DropdownMenu, ContextMenu, MoreMenu, SegmentedControl, Toolbar |
| Form Controls | 값을 입력하고 고르는 것 | TextInput, TextArea, NumberInput, FileInput, DateInput, DateRangeInput, DateTimeInput, TimeInput, Calendar, CheckboxInput, CheckboxList, RadioList, Switch, Slider, Selector, MultiSelector, ComplexSelector, Typeahead, Tokenizer, PowerSearch, Field, FieldStatus, InputGroup, Indicator |
| Overlay | 페이지 위에 뜨는 것 | Dialog, AlertDialog, Drawer, BottomSheet, BottomSheetSwitcher, Popover, HoverCard, Tooltip, Toast, CommandPalette, Lightbox, Overlay |
| Navigation | 이동과 위치 표시 | TopNav, SideNav, MobileNav, NavHeadingMenu, NavIcon, Breadcrumbs, TabList, Stepper, Pagination, Outline |
| Layout | 배치와 간격 | AppShell, Layout, Stack, Grid, Center, Section, FormLayout, Resizable, AspectRatio, Divider, ScrollableArea |
| Container | 내용을 담는 상자 | Card, ClickableCard, SelectableCard, Collapsible, Carousel |
| Content | 내용 그 자체 | Text(Heading 포함), Avatar, AvatarGroup, Icon, Code, CodeBlock, Markdown, Citation, Blockquote, Kbd, Token, Thumbnail, Timestamp, Timer, EmptyState |
| Feedback & Status | 상태를 알리는 것 | Badge, Banner, InfoTip, ProgressBar, Skeleton, Spinner, StatusDot |
| Table & List | 줄 단위 데이터 | Table, List, Item, MetadataList, TreeList, OverflowList |
| Chat | 대화형 UI | Chat(ChatComposer, ChatMessage 등), ChatDictationButton, ChatToolCalls |
| Utility | 프로바이더와 설정 | Theme, MediaTheme, SyntaxTheme, LinkProvider, Layer(LayerProvider), VisuallyHidden |

`category`보다 한 단계 작은 묶음이 `group`입니다. `Button`, `IconButton`, `ToggleButton`, `ButtonGroup`은 모두 `group: 'Button'`입니다. 컴포넌트 이름과 같지 않은 그룹은 `packages/core/groups.doc.mjs`에 따로 정의되어 있는데, Chat, Checkbox, Layout, Radio, Tabs, Utilities 여섯 개이고 각각 대표 컴포넌트(ChatComposer, CheckboxList, Stack, RadioList, TabList, Theme)가 지정되어 있습니다.

`Toast`가 Feedback이 아니라 Overlay에, `Link`와 `SegmentedControl`이 Action에, `TabList`가 Navigation에 들어 있는 점은 기억해 둘 만합니다. 폼 컨트롤이 24개로 가장 많습니다. 레이아웃 범주(AppShell, Layout, Stack 등)는 [Astryx 레이아웃과 템플릿](/blog/astryx-layout-templates/)에서 따로 다룹니다.

### import는 컴포넌트마다 하위 경로에서

공식 README와 컴포넌트 문서의 예제는 모두 컴포넌트별 하위 경로에서 import합니다.

```tsx
import {Button} from '@astryxdesign/core/Button';
import {TextInput} from '@astryxdesign/core/TextInput';
import {HStack} from '@astryxdesign/core/HStack';
```

`packages/core/package.json`의 `exports`에는 컴포넌트 폴더 이름과 같은 하위 경로가 하나씩 등록되어 있고, 같은 폴더에 사는 하위 컴포넌트와 훅은 부모의 경로에서 가져옵니다. `DialogHeader`는 `@astryxdesign/core/Dialog`, `useToast`는 `@astryxdesign/core/Toast`, 열 너비 헬퍼 `proportional`과 `pixel`은 `@astryxdesign/core/Table`입니다. 패키지 루트(`@astryxdesign/core`)도 같은 이름을 다시 내보내고, README의 CDN 예제는 루트에서 한꺼번에 가져옵니다.

"`Button`에 `isIconOnly`가 있으니 `IconButton`도 Button 경로에 있겠지"라고 생각하기 쉬운데, Button 문서는 이것을 명시적으로 부정합니다. `IconButton`은 별도 컴포넌트이고 `@astryxdesign/core/IconButton`에서 가져옵니다. 하위 경로의 단위는 "비슷해 보이는 것"이 아니라 폴더입니다.

하위 경로에는 성능상의 이유도 있습니다. `component-import-boundaries` 설계 문서는 공개 import 하나가 상호작용 없이 그려지는 것만 싣도록 정합니다. Popover나 DropdownMenu의 표면(surface)은 사용자가 처음 의도를 보였을 때(포인터 진입, 포커스, 누르기) 불러오고, Tooltip과 HoverCard는 첫 페인트 뒤에 불러옵니다. Table의 가상화처럼 켜야만 쓰는 기능은 그 훅을 import한 페이지에만 실립니다.

## 모든 컴포넌트가 공유하는 API 관례

README가 적어 둔 Astryx의 원칙 네 가지 중 두 번째가 "강하고 문서화된 관례(Strong, documented conventions)"입니다. 모든 컴포넌트가 같은 이름, prop, 합성 규칙을 따르니 몇 개를 배우면 나머지가 익숙하게 느껴지고, 사람과 AI 모두 처음 보는 컴포넌트의 동작을 예측할 수 있다는 내용입니다. 구체적인 관례는 `docs/contributing/api-conventions.md`와 `docs/architecture/public-component-api.md`에 있습니다.

### 이름 문법

| 대상 | 규칙 | 예 |
| --- | --- | --- |
| 컴포넌트 | 접두사 없는 PascalCase | `Button`, `TextInput` |
| props 타입 | `<Component>Props` | `ButtonProps` |
| 공개 훅 | `use<Name>` | `usePopover` |
| 불리언 상태 | `is<Name>` | `isDisabled`, `isLoading` |
| 불리언 기능 | `has<Name>` | `hasClear`, `hasSearch` |
| 비제어 불리언 기본값 | `defaultIs<Name>`, `defaultHas<Name>` | `defaultIsOpen` |
| 동기 콜백 | `on<Verb>` | `onChange` |
| 범위를 밝힌 콜백 | `on<Verb><Scope>` | `onSidebarCollapsedChange` |
| 트랜지션 액션 | `<verb>Action` | `changeAction`, `clickAction` |
| 논리적 방향 | `start`, `end` | `startIcon`, `paddingEnd` |

HTML의 `disabled`, `required`, `readOnly`가 Astryx에서는 `isDisabled`, `isRequired`, `isReadOnly`이고, "지우기 버튼이 있다", "검색창이 있다"처럼 기능의 유무는 `hasClear`, `hasSearch`입니다. `is`/`has` 불리언은 세 번째 상태가 없는 진짜 켬/끔에만 씁니다.

네이티브 속성을 그대로 통과시키기만 하는 prop에는 `html`을 붙입니다. 폼 제출용 `name` 속성이 `htmlName`인 이유입니다. 컴포넌트가 개념을 직접 소유하면 접두사 없이 더 뜻이 분명한 이름을 씁니다.

방향은 `left`/`right` 대신 논리적 방향 `start`/`end`를 씁니다. 오른쪽에서 왼쪽으로 쓰는 언어(RTL)에서 자동으로 뒤집히게 하기 위해서입니다. Drawer의 `side`도 `'start' | 'end'`이고, Popover의 `placement`는 `'above' | 'below' | 'start' | 'end'`입니다. 그 밖에 시스템이 이미 쓰는 단어가 있어서, 앵커와의 간격은 `offset`, 가장자리에서 떨어진 거리는 `inset`, 깊이는 `elevation`입니다.

### 콜백과 액션은 다르다

Astryx에서 가장 낯선 관례가 `~Action`입니다. 콜백(`onClick`, `onChange`)은 이벤트를 동기적으로 알리고, 액션(`clickAction`, `changeAction`)은 트랜지션을 타는 작업을 시작합니다. 액션 이름은 `on`으로 시작하지 않으므로 `onChangeAction`은 틀린 이름입니다. 둘 다 넘기면 콜백이 먼저 실행되고 그다음 액션이 실행되며, 버튼 패밀리 계약에 따르면 콜백에서 이벤트를 막으면(`preventDefault()`) 액션은 실행되지 않습니다.

```tsx
import {Button} from '@astryxdesign/core/Button';

function SaveButton({save}: {save: () => Promise<void>}) {
  return (
    <Button
      label="변경 사항 저장"
      variant="primary"
      clickAction={async () => {
        await save();
      }}
    />
  );
}
```

Button 문서 기준으로 `clickAction`이 돌려준 Promise가 끝나지 않은 동안 버튼은 로딩 상태를 보여 주므로, `isLoading` 상태를 직접 `useState`로 들고 있을 필요가 없습니다. 진행 중에는 다시 눌러도 중복 실행되지 않고, `isInterruptible`을 주면 다시 누른 것이 진행 중인 액션을 대체합니다.

입력 쪽도 같습니다. 입력 필드 패밀리 계약은 `changeAction`이 있는 컴포넌트가 `onChange`를 먼저 부르고, 제안된 값을 낙관적으로 보여 주고, `changeAction`을 React 트랜지션 안에서 실행한다고 정합니다. core의 문서 파일 가운데 `changeAction`이 적힌 것이 21개입니다.

### 제어 방식이 원칙

`astryx docs principles`의 규칙 목록에는 "폼 입력은 제어 방식(value + onChange)"이라는 항목이 있고, `TextInput`은 `value`가 필수 prop입니다. 그리고 `onChange`의 첫 번째 인자는 이벤트가 아니라 값입니다.

```tsx
import {useState} from 'react';
import {TextInput} from '@astryxdesign/core/TextInput';

function EmailField() {
  const [email, setEmail] = useState('');
  const isInvalid = email !== '' && !email.includes('@');

  return (
    <TextInput
      label="이메일"
      type="email"
      value={email}
      onChange={setEmail}
      isRequired
      hasClear
      status={
        isInvalid
          ? {type: 'error', message: '이메일에는 @가 들어가야 합니다'}
          : undefined
      }
    />
  );
}
```

그래서 `onChange={setEmail}`처럼 setter를 바로 넘길 수 있습니다. TextInput의 시그니처는 `(value: string, e: ChangeEvent<HTMLInputElement>) => void`이고, 이벤트가 필요하면 두 번째 인자로 받습니다. `e.target.value`를 꺼내는 습관대로 쓰면 타입 오류가 납니다. `BaseProps`가 `defaultValue`와 `defaultChecked`를 일부러 빼 둔 것도 같은 맥락입니다.

열림 상태는 `isOpen`과 `onOpenChange` 한 쌍입니다. Dialog, Drawer, Popover, CommandPalette가 모두 이 이름을 쓰고, `onClose`와 `onOpen`을 따로 두지 않습니다.

### 크기와 변형

크기는 `size`, 시각적 변형은 `variant`입니다. 표준 크기 축은 `sm | md | lg`이고 기본값은 대개 `md`입니다. `component-size-cascade` 설계 문서는 크기가 결정되는 순서를 이렇게 정합니다.

1. 컴포넌트에 직접 준 `size` prop
2. 가장 가까운 제공자(provider)가 내려 준 값
3. 컴포넌트의 문서화된 기본값

제공자는 `ButtonGroup`, `InputGroup`, `Toolbar`, `SideNav` 같은 그룹 컴포넌트입니다. 그룹에 크기를 한 번 주면 안쪽 컨트롤이 따라오고, 자식에 직접 준 값은 언제나 이깁니다. 제공자는 기본값을 줄 뿐 강제하지 않습니다. 다만 `size`라는 이름의 prop이 있다고 해서 이 계단에 참여하는 것은 아니고, 문서는 참여가 명시적이어야 한다고 적습니다. Table은 `size` 대신 `density`(`'compact' | 'balanced' | 'spacious'`)를 쓰는데, 이것은 다른 축입니다.

변형에 대해서는 "시각만 바꾸는 불리언 대신 variant"라는 규칙(INV20)이 있습니다. Button은 `isPrimary`, `isDestructive`가 아니라 `variant="primary" | "secondary" | "ghost" | "destructive"`이고, 기본값은 `secondary`입니다.

### 슬롯과 아이콘

내용이 들어가는 자리는 이름 붙은 슬롯 prop으로 받습니다. Button의 `icon`과 `endContent`, Toast의 `endContent`, CommandPalette의 `input`과 `footer`가 그렇습니다. `api-conventions.md`의 예시는 이렇습니다.

```tsx
<AppShell
  topNav={<TopNav items={items} />}
  sideNav={<SideNav sections={sections} />}
/>
```

슬롯은 완성된 자식을 받아 그대로 그리고, `SideNav`의 상태나 콜백을 `AppShell`로 끌어올리지 않습니다. INV18은 부모가 자식의 내부 구조까지 건드리는 prop을 피하고 합성으로 풀라고 정합니다.

아이콘은 `<Icon icon="moreHorizontal" />`처럼 `Icon` 컴포넌트를 슬롯에 넣습니다. 여기서 `moreHorizontal`은 그림 파일이 아니라 의미 이름입니다. `icon-resolution-and-component-slots` 설계 문서에 따르면 이름이 실제 그림으로 바뀌는 순서는 활성 테마의 `icons`, 전역 `registerIcons()`, 기본 아이콘 순이라서, 테마를 바꾸면 같은 코드의 아이콘 그림이 통째로 바뀔 수 있습니다. 컴포넌트가 스스로 그리는 아이콘(Table의 정렬 화살표 등)은 `componentIcons` 슬롯으로 따로 관리되고, Table 문서에는 `table-sort-indicator`와 `table-row-expand` 두 슬롯이 적혀 있습니다. 테마 쪽 이야기는 [Astryx 테마와 디자인 토큰](/blog/astryx-theme-tokens/)에서 다룹니다.

### BaseProps: 모든 컴포넌트의 공통 바닥

`packages/core/src/BaseProps.ts`는 DOM 요소를 소유한 컴포넌트가 공유하는 기반 타입으로, `React.HTMLAttributes`에서 일부를 빼고 두 가지를 더한 것입니다. 남긴 것은 이벤트 핸들러, `aria-*`, `role`, `tabIndex`, `hidden`, `draggable`, `inert`, `dir`, `className`, `style`, `id`이고, 더한 것은 `xstyle`(StyleX 스타일)과 `data-*` 속성입니다.

뺀 것은 `children`, `title`, `contentEditable`, `dangerouslySetInnerHTML`, `autoFocus`, `defaultValue`, `defaultChecked`, 그리고 네이티브 `popover` 관련 속성 등입니다. 소스 주석은 뺀 기준을 "발등을 찍기 쉽거나, 폐기되었거나, 컴포넌트 API와 무관한 것"이라고 설명하고, 필요한 컴포넌트는 직접 선언합니다. TextInput의 `hasAutoFocus`가 그 예입니다.

스타일 입력에 대한 규칙도 있습니다. `xstyle`, `className`, `style`은 하나가 다른 것을 덮어쓰지 않고 합쳐지고(INV6), `ref`는 React 19 방식대로 일반 prop으로 받습니다(INV8). 스타일을 실제로 어떻게 재정의하는지는 [Astryx 스타일링](/blog/astryx-styling-tailwind-swizzle/)에서 다룹니다.

## "강제보다 안내"가 API에 드러나는 방식

README의 첫 번째 원칙은 "강제보다 안내(Guidance over enforcement)"입니다. 컴포넌트는 가로막는 가드레일이 아니라 능력을 주고, 디자인 의견은 문서와 예제에 살며, 값을 넘기면 컴포넌트는 그것을 그린다는 뜻입니다.

이 원칙은 API의 모양에서 확인할 수 있습니다. Button 문서의 모범 사례에는 "한 화면에 primary 버튼을 둘 이상 두지 말라"가 있지만, primary 버튼을 두 개 그려도 오류가 나지 않습니다. 모든 컴포넌트 문서의 `bestPractices`는 `guidance: true`(이렇게 하라)와 `guidance: false`(이렇게 하지 말라) 항목으로 되어 있어서, 규칙을 런타임이 아니라 읽는 쪽(사람과 AI)에게 전달합니다. 기본 동작을 정하더라도 호출자의 선택이 이깁니다. 터치 화면에서 Selector나 Popover가 팝오버 대신 바텀 시트로 바뀔 수 있는데, 이때 `presentation` prop 하나로 호출자가 고르고(`'popover' | 'bottom-sheet' | 'adaptive'`), INV16은 호출자의 명시적인 선택이 터치 기본값보다 항상 우선한다고 정합니다.

다만 아무것도 강제하지 않는 것은 아닙니다. 접근성과 직결된 것은 필수 prop이라서 Button의 `label`, TextInput의 `label`은 `required`이고, 아이콘만 있는 버튼에서도 `label`이 `aria-label`이 됩니다. 한 prop은 한 가지 개념만 다루고, 값에 따라 다루는 축이 달라지는 prop은 거부됩니다. 새 prop에는 입장 조건이 있어서, 컴포넌트가 상태, 내용, 레이아웃, 맥락에서 스스로 알아낼 수 있는 것은 prop으로 노출하지 않습니다(INV4). 쓰는 사람에게는 안내하고, API를 늘리는 사람에게는 엄격한 구조입니다. 강제의 대상이 사용자가 아니라 시스템 자신입니다.

## 패밀리 계약: 형제들이 공유하는 규칙

`docs/families/`에는 패밀리 계약(family contract) 문서가 있습니다. 형제 컴포넌트가 공유하는 동작을 한곳에 적고, 각 컴포넌트 명세는 규칙을 복사하지 않고 패밀리를 링크합니다. 소속은 "`<button>`을 그리는가" 같은 구현이 아니라 공개적인 책임으로 정합니다.

### buttons

구성원은 Button, IconButton, ToggleButton, ButtonGroup, ToggleButtonGroup이고, Link, Switch, SegmentedControl, TabList는 버튼처럼 보여도 구성원이 아닙니다. 모든 컨트롤은 비어 있지 않은 접근 가능한 `label`을 받아야 합니다. 비활성 버튼은 콜백과 액션을 실행하지 않지만 포커스는 받을 수 있고, Button 문서도 `isDisabled`가 네이티브 `disabled` 대신 `aria-disabled`를 쓴다고 적습니다. 진행 중 상태는 `aria-busy`를 설정하고 컨트롤의 크기를 바꾸지 않습니다. `sm`, `md`, `lg`는 구성원 모두에서 같은 높이 계약에 대응하고, 아이콘 전용은 정사각형입니다. 그림자(`elevation`)는 눈에 보이는 표면을 칠하는 요소가 소유해서, 연결된 ButtonGroup 안에서는 그룹이 그림자 하나를 갖고 구성원의 `elevation`은 무시됩니다.

### input-fields

구성원은 TextInput, TextArea, NumberInput, DateInput, DateRangeInput, DateTimeInput, TimeInput, FileInput, Selector, MultiSelector, ComplexSelector, Typeahead, Tokenizer이고, Field, FieldStatus, FormLayout, InputGroup은 협력자일 뿐 구성원은 아닙니다.

값이 채워지거나 스피너, 상태 아이콘, 지우기 버튼이 나타나도 필드의 바깥 너비는 변하지 않습니다. 단독 Selector만 예외로 표시 내용에 따라 크기가 정해질 수 있습니다. `isLoading`은 필드의 값이 해석 중이거나 저장 중이라는 뜻이지, 선택지 데이터를 불러오는 중이라는 뜻이 아닙니다. `disabledMessage`가 있는 구성원은 비활성 상태에서도 포커스를 받아 이유를 보여 줍니다. 상태 메시지 배치는 `statusVariant`로 고르는데, 모든 입력은 `detached`와 `tooltip`을 지원하고 `attached`는 조건을 만족하는 컨트롤만 지원합니다. 지우기 버튼의 툴팁은 어떤 필드에서든 "Clear"입니다.

이 패밀리에는 중요한 예외가 하나 있습니다(FR10). Field로 구성된 컴포넌트는 루트 `xstyle`, `className`, `style`을 받지 않고, 넘기면 타입 오류입니다. 필드에 스타일을 줄 표면이 레이블과 상태까지 포함한 필드 전체와, 테두리와 배경을 칠하는 컨트롤 상자 둘이라서, 루트 `xstyle` 하나로는 어느 쪽에 적용할지 임의로 정해야 하기 때문입니다. 그래서 `containerXstyle`/`containerClassName`/`containerStyle`과 `controlXstyle`/`controlClassName`/`controlStyle` 두 벌로 나눴습니다. 반면 `ref`, `id`, `data-*`, `aria-*`, DOM 이벤트 핸들러는 사용자가 실제로 조작하는 컨트롤(네이티브 input 등)에 닿습니다. "모든 컴포넌트가 `className`을 받는다"고 외워 두면 입력 필드에서 걸립니다.

### action-groups

형제 액션 둘 이상이 모인 그룹의 누르기 동작을 통일합니다. 메뉴(DropdownMenu, ContextMenu), Selector와 MultiSelector의 선택지, ButtonGroup, ToggleButtonGroup, Toolbar의 버튼, AlertDialog의 액션 등이 구성원입니다. 터치에서 한 액션을 누른 채 옆으로 미끄러지면 하이라이트가 손가락을 따라가고 손을 뗀 곳의 액션이 실행되며, 그룹 밖에서 떼면 아무 일도 일어나지 않습니다. 마우스는 네이티브 버튼처럼 누른 곳에서 뗐을 때만 실행됩니다. SegmentedControl은 이름이 명시된 예외입니다.

### overlay-dismissal

Escape나 플랫폼의 닫기 요청으로 닫히는 층을 가진 컴포넌트가 구성원입니다. Dialog, AlertDialog, Popover, DropdownMenu, Tooltip, HoverCard, Drawer, BottomSheet, CommandPalette, Lightbox, 그리고 Selector나 DateInput처럼 자기 팝업을 가진 입력들입니다. 기본 규칙은 "요청 하나는 표면 하나에만 영향을 준다"입니다. Dialog 안에서 Selector를 열고 Escape를 누르면 Selector만 닫히고, 한 번 더 눌러야 Dialog가 닫힙니다.

한국어 사용자에게 반가운 규칙도 있습니다. IME 조합을 취소하려고 누른 Escape는 층을 닫지 않습니다. 배경 누르기는 누름이 배경에서 시작하고 배경에서 끝났을 때만 닫아서, 다이얼로그 안에서 텍스트를 드래그하다가 바깥에서 손을 떼도 닫히지 않습니다.

### navigation-destinations

목적지(URL)를 받거나 만들어 내는 컴포넌트가 구성원입니다. Link, Button의 `href` 모드, BreadcrumbItem, SideNavItem, TopNavItem, Tab, Token, ClickableCard, Markdown 링크 등입니다. 정규화한 뒤 `javascript:`, `vbscript:`, `data:text/html` 스킴은 내비게이션이 되지 않습니다. `LinkProvider`나 `as`로 커스텀 링크 컴포넌트(예: Next.js Link)로 바꿔도, 새 탭이나 Cmd/Ctrl 클릭, 가운데 클릭으로 열어도 같은 판정이 적용됩니다. 상대 경로, HTTP(S), `mailto`, `tel` 등은 기존 동작을 유지합니다.

## 대표 컴포넌트를 문서로 읽기

### Button

문서의 해부(anatomy)는 Icon, Label, End content, Spinner 네 부분이고 Label만 필수입니다. `label`은 보이는 텍스트이자 접근 가능한 이름이라, `children`을 주면 보이는 내용만 바뀌고 `label`은 여전히 필요합니다. 기본값은 `variant`가 `'secondary'`, `size`가 `'md'`, `elevation`이 `'none'`, `type`이 `'button'`이므로 폼 제출 버튼은 `type="submit"`을 직접 줍니다. `href`를 주면 링크 요소로 그려지고, `as`로 커스텀 링크 컴포넌트를 지정합니다. 기본적으로 내용 크기에 맞고, 줄이 좁으면 레이블이 말줄임표로 잘립니다.

### TextInput과 Field

TextInput은 레이블, 설명, 상태 메시지를 스스로 그립니다. `label`, `description`, `isOptional`/`isRequired`, `status`, `placeholder`, `hasClear`, `isLoading`, `disabledMessage`가 모두 TextInput의 prop입니다. `onEnter`는 IME로 한글, 일본어, 중국어 변환을 확정하는 Enter에는 실행되지 않는다고 문서에 적혀 있습니다.

그러면 `Field`는 언제 쓸까요. Field 문서는 "필드 껍데기를 이미 제공하지 않는 커스텀, 네이티브, 서드파티 컨트롤을 감쌀 때"라고 답합니다. Field 문서의 예제는 네이티브 `<input type="range">`를 감싸면서 `label`, `inputID`, `description`, `descriptionID`를 주고, 안쪽 input의 `id`와 `aria-describedby`를 같은 값으로 잇습니다. 흔한 실수는 TextInput을 Field로 한 번 더 감싸는 것인데, 문서는 이것을 하지 말라고 명시합니다. TextInput, Typeahead, DateInput, TextArea 같은 입력은 이미 자기 Field 껍데기를 그립니다.

### Selector, MultiSelector, Typeahead

셋 다 "목록에서 고르기"지만 쓰임이 다릅니다.

| | Selector | MultiSelector | Typeahead |
| --- | --- | --- | --- |
| 고르는 개수 | 하나 | 여러 개 | 하나 |
| 값 | `value: string` | `value: string[]` | `value: T \| null` |
| 선택지 | `options` 배열 | `options` 배열 | `searchSource` |
| 알맞은 규모 | 보통 크기의 고정 목록 | 유한한 목록 | 크거나 동적인 데이터 |
| 검색 | `hasSearch`로 켬 | `hasSearch`로 켬 | 입력 자체가 검색 |

문서는 선택지가 둘뿐이면 Selector 대신 SegmentedControl이나 라디오를, 예/아니오는 Switch나 CheckboxInput을 쓰라고 안내합니다. 명령 실행이나 이동은 Selector가 아니라 DropdownMenu이고, 선택지가 20개쯤을 넘는데 섹션도 없다면 Typeahead를 고려합니다. 여러 개를 검색해서 고르려면 Typeahead가 아니라 Tokenizer입니다.

Selector의 `options`는 문자열, 객체(`value`, `label` 등), 구분선(`{type: 'divider'}`), 섹션(`{type: 'section', title, options}`)을 받고, 선택지 줄을 바꾸려면 JSX 자식이 아니라 `renderOption`을 씁니다. Typeahead의 `searchSource`는 `search`와 `bootstrap` 메서드를 가진 데이터 소스입니다. 고정 목록이면 `@astryxdesign/core/Typeahead`에서 가져오는 `createStaticSource`로 만들 수 있습니다.

### Dialog, Drawer, Popover, Tooltip

네 컴포넌트는 "페이지 위의 층"이라는 점이 같고 무게가 다릅니다.

| 컴포넌트 | 쓰임 | 눈여겨볼 prop |
| --- | --- | --- |
| Dialog | 응답할 때까지 페이지를 막는 모달 | `isOpen`, `onOpenChange`, `purpose`, `variant`, `width` |
| Drawer | 레이아웃 위에 뜨는 옆 패널(행을 누르면 상세 보기) | `isOpen`, `onOpenChange`, `label`, `side`, `hasScrim`, `purpose` |
| Popover | 클릭으로 여는 앵커 기반 오버레이 | `content`, `label`, `placement`, `alignment`, `presentation` |
| Tooltip | 호버나 포커스에 뜨는 짧은 텍스트 힌트 | `content`, `placement`, `delay`, `touchTrigger` |

Dialog와 Drawer의 `purpose`는 닫기 동작을 정합니다. `info`(기본)는 Escape와 배경 누르기를 모두 허용하고, `form`은 사용자가 입력한 뒤에는 배경 누르기를 막고, `required`는 둘 다 막습니다. 문서는 입력이 있는 다이얼로그에 `purpose="form"`을 쓰라고 안내합니다.

```tsx
import {Dialog, DialogHeader} from '@astryxdesign/core/Dialog';

<Dialog isOpen={isOpen} onOpenChange={setIsOpen} purpose="form">
  <DialogHeader title="프로필 수정" onOpenChange={setIsOpen} />
  {/* 폼 내용 */}
</Dialog>
```

Dialog는 네이티브 `<dialog>` 요소를 씁니다. 열림 상태를 관리하고 싶지 않으면 `useImperativeDialog` 훅으로 `dialog.show(content)`를 부르고 `dialog.element`를 트리에 그립니다. Popover는 트리거를 `children`으로, 내용을 `content`로 받습니다. Tooltip에는 버튼이나 링크 같은 상호작용 요소를 넣지 않고(그럴 때는 HoverCard나 Popover), 작업을 끝내는 데 꼭 필요한 정보도 넣지 않습니다.

이 층들의 바닥에는 `layer-runtime` 설계가 있습니다. 주 경로는 브라우저의 네이티브 Popover API와 CSS Anchor Positioning이고, Dialog는 `showModal()`을 씁니다. `showPopover`가 없는 브라우저에서는 `display` 전환으로 대체되는데, 이때는 최상위 층(top layer) 승격, 네이티브 바깥 누르기 닫기, 앵커 기반 위치와 충돌 회피가 재현되지 않습니다. 구형 브라우저를 지원해야 한다면 도입 전에 직접 확인할 부분입니다.

### Table

Table은 두 가지 방식으로 씁니다. 데이터 주도 방식은 `data`와 `columns`를 넘깁니다.

```tsx
import {Table, proportional, pixel} from '@astryxdesign/core/Table';

<Table
  data={members}
  idKey="id"
  density="compact"
  hasHover
  columns={[
    {key: 'name', header: '이름', width: proportional(2)},
    {key: 'role', header: '역할', width: proportional(1)},
    {key: 'status', header: '상태', width: pixel(120)},
  ]}
/>
```

`width`는 숫자가 아니라 `proportional(n)`이나 `pixel(n)` 헬퍼의 결과이고, 생략하면 같은 비율로 나누고 60px 바닥을 둡니다. 행 타입 `T`는 `Record<string, unknown>`을 확장해야 합니다.

자식 방식은 `TableHeader`, `TableBody`, `TableFooter` 안에 `TableRow`와 `TableCell`을 직접 조립합니다. 이때 `TableRow`를 `Table` 바로 아래에 두면 안 됩니다. `<table><tr>`은 유효하지 않은 HTML이고, 서버가 그린 마크업에는 파서가 암묵적인 `<tbody>`를 끼워 넣지만 클라이언트의 React는 그러지 않아 하이드레이션이 어긋납니다.

정렬, 선택, 페이지네이션, 필터, 트리, 열 설정은 플러그인 훅으로 붙입니다. `useTableSortable({sort, onSortChange})`가 돌려준 플러그인을 `plugins={{sort: sortPlugin}}`처럼 이름을 붙여 넘깁니다. 정렬 방향은 `'asc'`가 아니라 `'ascending'`, `'descending'`으로 전체 단어를 씁니다. 문서는 모든 플러그인을 한꺼번에 켜지 말라고 안내합니다.

### Toast

Toast는 컴포넌트지만, 문서는 실사용에서 `useToast()` 훅을 권합니다.

```tsx
import {Button} from '@astryxdesign/core/Button';
import {useToast} from '@astryxdesign/core/Toast';

function SaveStatus() {
  const showToast = useToast();

  return (
    <Button
      label="저장"
      onClick={() => showToast({body: '변경 사항을 저장했습니다', uniqueID: 'save'})}
    />
  );
}
```

`showToast`는 닫는 함수를 돌려줍니다. `type`은 `'info' | 'error'`이고 오류 토스트는 닫을 때까지 남으며, 자동으로 사라지는 시간의 기본값은 5000ms입니다. `uniqueID`를 주면 저장 버튼을 여러 번 눌러도 토스트가 쌓이지 않습니다. 위치와 최대 개수는 앱 루트 근처의 `LayerProvider`의 `toast` prop으로 설정하고, `useToast`는 `LayerProvider`를 그리는 바로 그 컴포넌트가 아니라 그 안쪽 자식에서 불러야 합니다. 문서는 사용자를 막는 치명적 오류나 폼 검증 오류에는 토스트를 쓰지 말라고 안내합니다.

### CommandPalette

CommandPalette는 명령과 이동에 빠르게 접근하는 검색 다이얼로그이고, Typeahead와 같은 `searchSource`를 씁니다.

```tsx
import {useMemo, useState} from 'react';
import {CommandPalette} from '@astryxdesign/core/CommandPalette';
import {createStaticSource} from '@astryxdesign/core/Typeahead';

function AppCommands() {
  const [isOpen, setIsOpen] = useState(false);
  const source = useMemo(
    () =>
      createStaticSource([
        {id: 'home', label: '홈', auxiliaryData: {group: '이동'}},
        {id: 'settings', label: '설정', auxiliaryData: {group: '이동'}},
      ]),
    [],
  );

  return (
    <CommandPalette
      isOpen={isOpen}
      onOpenChange={setIsOpen}
      searchSource={source}
    />
  );
}
```

`auxiliaryData.group`을 주면 결과가 그룹 제목 아래로 자동으로 묶입니다. `input`과 `footer`는 슬롯이고 기본값은 각각 `<CommandPaletteInput />`, `<CommandPaletteFooter />`입니다. `renderItem`이 돌려주는 내용에는 버튼이나 링크를 넣지 않습니다. 한 줄이 선택지 하나이기 때문입니다.

## 컴포넌트 문서를 찾는 법

Astryx의 컴포넌트 문서는 소스 옆의 `*.doc.mjs`가 원본입니다. `public-component-api` 문서는 이 파일이 "소비자를 향한 prop 설명, 기본값, 예제"를 소유한다고 적고, 문서가 코드에 없는 prop을 만들어 내지 못하도록 테스트(`docPropReferences.test.ts`, `docPropLiterals.test.ts`)가 걸려 있습니다. Astryx의 원칙 문서도 prop을 지어내지 말고 컴포넌트 문서를 먼저 읽으라는 내용을 안티패턴 목록에 넣어 두었습니다.

이 문서를 읽는 기본 도구가 CLI입니다.

```bash
npx @astryxdesign/cli component --list              # 범주별 전체 목록
npx @astryxdesign/cli component --category Layout   # 한 묶음만
npx @astryxdesign/cli component Button              # Button 문서 전체
npx @astryxdesign/cli component Button Badge Text   # 여러 개를 한 번에
npx @astryxdesign/cli component Button --props --json
```

CLI를 프로젝트에 설치한 뒤에는 `astryx component Button`처럼 짧게 씁니다. README는 설치 전에는 반드시 범위가 붙은 이름(`@astryxdesign/cli`)을 쓰라고 경고합니다. 범위 없는 `astryx`는 npm에서 무관한 패키지로 풀립니다. 옵션은 `--props`(prop 목록만), `--source`(컴포넌트 소스), `--showcase`(쇼케이스 소스), `--blocks`(예제 블록 목록), `--package <이름>`(특정 패키지로 한정)입니다. `component`의 인자는 자유 검색어가 아니라 정확한 이름이라서, 이름이 기억나지 않으면 `astryx search`를 씁니다.

문서 한 편의 구성은 어느 컴포넌트나 같습니다. 언제 쓰는지(`usage.description`), 할 것과 하지 말 것(`bestPractices`), 해부 구조(`anatomy`), prop 표(`props`), 예제(`examples`), 테마 대상(`theming`)입니다. 하위 컴포넌트와 훅은 부모 문서의 `components` 목록에 이름으로 걸려 있고, 자기 문서에는 `subComponentOf`로 부모를 가리킵니다.

눈으로 보고 싶으면 Storybook(https://astryx.atmeta.com/storybook/)과 문서 사이트(https://astryx.atmeta.com)가 있습니다. CLI 전체는 [Astryx CLI 완전 정복](/blog/astryx-cli/)에서 다룹니다.

## 관례의 예외와 lab 컴포넌트

관례가 강하다고 해서 예외가 없는 것은 아닙니다. 설계 문서는 이런 예외를 "알려진 검증 공백"으로 따로 적어 둡니다. 규칙은 비제어 기본값을 `defaultIs<Name>`으로 정하지만, Tooltip, HoverCard, MultiSelector 문서에는 `isDefaultOpen`이 있고 Collapsible은 `defaultIsOpen`을 씁니다. Dialog의 `isInline`, Popover의 `hasLightDismiss`와 `isModal`, Banner의 `isDismissable` 등도 현재 규칙에서 벗어난 것으로 문서에 나열되어 있습니다.

출시된 API는 규칙에 맞추려고 바꾸지 않습니다. INV21a는 출시된 API의 변경에는 사용자 가치가 필요하고, 규칙 준수만으로는 이유가 되지 않는다고 정합니다. 그래서 위의 예외는 한동안 남습니다. 패밀리 계약도 목표일 뿐 적용이 끝났다는 뜻이 아닌 항목이 있어서, action-groups와 overlay-dismissal 문서 모두 구현 공백을 따로 표로 적습니다. 관례로 추측하되, 추측한 뒤에는 `astryx component <이름>`으로 확인하는 편이 좋습니다. 이 글의 prop 이름은 v0.7.16 전후의 문서 기준이고, 버전 정책과 큰 변경에 대응하는 방법은 [Meta Astryx란 무엇인가](/blog/astryx-overview/)와 [Astryx CLI 완전 정복](/blog/astryx-cli/)을 참고하세요.

새 컴포넌트는 `@astryxdesign/lab`에서 시작합니다. lab 패키지의 README에 따르면 lab 컴포넌트는 동작하고 기본 prop이 있지만 API가 바뀔 수 있고, 접근성 보강, 바이브 테스트, 완전한 테마 대응이 끝나지 않았습니다. core 컴포넌트는 키보드와 접근성이 완비되고, 테마 대응과 상태 표현이 갖춰지고, 명세를 따르고, 바이브 테스트를 거친 것입니다. 승격의 관문은 접근성 체크리스트입니다. lab 컴포넌트도 core와 같은 접근성 검사를 받지만, 발견된 문제가 lab 병합을 막지는 않고 승격을 막습니다.

lab에는 안정(`latest`) 릴리스도, 안정성 약속도 없습니다. lab README에 따르면 카나리 빌드는 어느 두 버전 사이에서도 깨질 수 있어서, 제품 코드에서 lab에 기대는 것은 권하기 어렵습니다. core 안에도 실험 표시가 있습니다. Drawer의 `experimental` prop(`{isFullWidthOnMobile?: boolean}`)은 문서에 `stability: 'experimental'`로 표시되어 있고, CLI 문서는 실험 기능이 사용 중단 기간 없이 어느 패치 릴리스에서든 바뀌거나 사라질 수 있다고 설명합니다.

## 참고

- [Astryx 저장소 README](https://github.com/meta/astryx/blob/main/README.md)
- [packages/core/README.md](https://github.com/meta/astryx/blob/main/packages/core/README.md)
- [packages/core/groups.doc.mjs](https://github.com/meta/astryx/blob/main/packages/core/groups.doc.mjs)
- [packages/core/src/index.ts](https://github.com/meta/astryx/blob/main/packages/core/src/index.ts)
- [packages/core/src/BaseProps.ts](https://github.com/meta/astryx/blob/main/packages/core/src/BaseProps.ts)
- [docs/contributing/api-conventions.md](https://github.com/meta/astryx/blob/main/docs/contributing/api-conventions.md)
- [docs/architecture/public-component-api.md](https://github.com/meta/astryx/blob/main/docs/architecture/public-component-api.md)
- [docs/architecture/component-import-boundaries.md](https://github.com/meta/astryx/blob/main/docs/architecture/component-import-boundaries.md)
- [docs/architecture/component-size-cascade.md](https://github.com/meta/astryx/blob/main/docs/architecture/component-size-cascade.md)
- [docs/architecture/icon-resolution-and-component-slots.md](https://github.com/meta/astryx/blob/main/docs/architecture/icon-resolution-and-component-slots.md)
- [docs/architecture/layer-runtime.md](https://github.com/meta/astryx/blob/main/docs/architecture/layer-runtime.md)
- [docs/families/buttons.md](https://github.com/meta/astryx/blob/main/docs/families/buttons.md)
- [docs/families/input-fields.md](https://github.com/meta/astryx/blob/main/docs/families/input-fields.md)
- [docs/families/action-groups.md](https://github.com/meta/astryx/blob/main/docs/families/action-groups.md)
- [docs/families/overlay-dismissal.md](https://github.com/meta/astryx/blob/main/docs/families/overlay-dismissal.md)
- [docs/families/navigation-destinations.md](https://github.com/meta/astryx/blob/main/docs/families/navigation-destinations.md)
- [packages/cli/assets/docs/principles.doc.mjs](https://github.com/meta/astryx/blob/main/packages/cli/assets/docs/principles.doc.mjs)
- [packages/cli/assets/docs/tree/component-lookups.doc.mjs](https://github.com/meta/astryx/blob/main/packages/cli/assets/docs/tree/component-lookups.doc.mjs)
- [packages/cli/assets/docs/tree/experimental.doc.mjs](https://github.com/meta/astryx/blob/main/packages/cli/assets/docs/tree/experimental.doc.mjs)
- [packages/cli/clients/cli/commands/component.doc.mjs](https://github.com/meta/astryx/blob/main/packages/cli/clients/cli/commands/component.doc.mjs)
- [Button.doc.mjs](https://github.com/meta/astryx/blob/main/packages/core/src/Button/Button.doc.mjs)
- [TextInput.doc.mjs](https://github.com/meta/astryx/blob/main/packages/core/src/TextInput/TextInput.doc.mjs)
- [Field.doc.mjs](https://github.com/meta/astryx/blob/main/packages/core/src/Field/Field.doc.mjs)
- [Selector.doc.mjs](https://github.com/meta/astryx/blob/main/packages/core/src/Selector/Selector.doc.mjs)
- [MultiSelector.doc.mjs](https://github.com/meta/astryx/blob/main/packages/core/src/MultiSelector/MultiSelector.doc.mjs)
- [Typeahead.doc.mjs](https://github.com/meta/astryx/blob/main/packages/core/src/Typeahead/Typeahead.doc.mjs)
- [Dialog.doc.mjs](https://github.com/meta/astryx/blob/main/packages/core/src/Dialog/Dialog.doc.mjs)
- [Drawer.doc.mjs](https://github.com/meta/astryx/blob/main/packages/core/src/Drawer/Drawer.doc.mjs)
- [Popover.doc.mjs](https://github.com/meta/astryx/blob/main/packages/core/src/Popover/Popover.doc.mjs)
- [Tooltip.doc.mjs](https://github.com/meta/astryx/blob/main/packages/core/src/Tooltip/Tooltip.doc.mjs)
- [Table.doc.mjs](https://github.com/meta/astryx/blob/main/packages/core/src/Table/Table.doc.mjs)
- [Toast.doc.mjs](https://github.com/meta/astryx/blob/main/packages/core/src/Toast/Toast.doc.mjs)
- [useToast.doc.mjs](https://github.com/meta/astryx/blob/main/packages/core/src/Toast/useToast.doc.mjs)
- [CommandPalette.doc.mjs](https://github.com/meta/astryx/blob/main/packages/core/src/CommandPalette/CommandPalette.doc.mjs)
- [packages/lab/README.md](https://github.com/meta/astryx/blob/main/packages/lab/README.md)
