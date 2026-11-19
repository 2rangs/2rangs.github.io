
> **참고** 이 글은 "Meta Astryx 완전 가이드" 10부작의 4편입니다. Astryx v0.7.16(2026년 11월) 공식 저장소의 문서와 소스를 읽고 정리했습니다. Astryx는 베타라서 이후 버전에서 달라질 수 있습니다.

관리자 화면을 하나 새로 만든다고 해 봅시다.
왼쪽에 메뉴, 위에 제목 줄, 가운데에 표, 오른쪽에 상세 패널이 있는 흔한 화면입니다.

늘 하던 대로 `div`에 `display: flex`를 주고 시작합니다.
본문에 `padding: 24px`, 카드에 `padding: 16px`.
그런데 카드 안에 넣은 표는 양옆이 16px씩 들어가 있어서 어색합니다.
구분선도 카드 끝까지 닿지 않습니다.
그래서 표에 `margin: 0 -16px`을 줍니다.
몇 주 뒤 누군가 카드 패딩을 20px로 바꾸고, 음수 마진은 16px인 채로 남습니다.

화면의 뼈대와 간격은 가장 먼저 정해야 하는데, 대개는 가장 늦게, 그때그때 정해집니다.

Astryx는 Meta가 사내에서 쓰던 디자인 시스템을 공개한 오픈소스 React 컴포넌트 라이브러리입니다.
이번 편에서는 그중 화면의 뼈대를 맡는 부분을 봅니다.
레이아웃 컴포넌트, 간격 규칙, 페이지 틀, 그리고 복사해서 쓰는 템플릿입니다.

## 한눈에 보기

- Astryx의 레이아웃 컴포넌트는 두 무리로 나뉩니다. 임의의 자식을 배치하는 기본 요소(Stack, HStack, VStack, StackItem, Grid, GridSpan, Center)와 구조적 영역을 만드는 요소(Section, Layout과 그 영역들, Toolbar)입니다.
- Astryx의 `gap`과 `padding` prop은 픽셀이 아니라 간격 단계(0, 0.5, 1, 1.5, 2, 3, 4, 5, 6, 8, 10)를 받습니다. 한 단계는 0.25rem이고, 브라우저 기본 글꼴 크기에서 4px입니다.
- Astryx의 AppShell은 앱 전체 틀(상단·측면 내비게이션, 배너, 모바일 서랍, 본문)을 맡습니다. Layout은 그 안에서 한 페이지를 header, start, content, end, footer 다섯 슬롯으로 나눕니다.
- Astryx의 Grid는 `columns={4}`처럼 숫자를 주면 어떤 폭에서도 정확히 4열이고 줄바꿈하지 않습니다. 좁은 화면에서 열 수가 줄어들게 하려면 `columns={{minWidth: 240, max: 4}}`처럼 객체를 줍니다.
- Astryx의 템플릿(template)은 컴포넌트와 달리 패키지 의존성으로 남지 않고 앱 코드로 복사됩니다. 복사한 뒤에는 Astryx 버전을 올려도 그 파일이 바뀌지 않습니다.
- Astryx v0.7.16 무렵 저장소의 `packages/cli/assets/templates/pages`에는 페이지 템플릿 폴더가 58개 있고, 대시보드·표·폼·로그인·설정·갤러리·콘텐츠·AI 채팅·도구·셸 열 계열로 나뉩니다.
- Astryx의 페이지 템플릿은 `Shell -` 계열을 빼면 페이지 콘텐츠만 담습니다. 사이드바 같은 앱 크롬(chrome)은 쓰는 쪽에서 AppShell로 직접 감쌉니다.
- Astryx 템플릿은 `astryx template --list`로 찾고, `astryx template <이름> --skeleton`으로 구조를 보고, `astryx template <이름> <경로>`로 복사합니다.

## 레이아웃 기본 요소

Astryx 저장소에는 컴포넌트 묶음마다 무엇을 공유하고 무엇이 다른지 적은 "가족 계약" 문서가 있습니다.
레이아웃은 두 가족으로 나뉘어 있습니다.

- **레이아웃 기본 요소(layout primitives)**: Stack, HStack, VStack, StackItem, Grid, GridSpan, Center. 어떤 자식이든 받아서 한 방향이나 두 방향으로 배치하고 가운데에 놓습니다.
- **레이아웃 영역(layout regions)**: Section, Layout, LayoutHeader, LayoutContent, LayoutFooter, LayoutPanel, Toolbar. 자식을 늘어놓는 것보다 강한 경계, 곧 "여기는 헤더", "여기는 패널" 같은 구조적 영역을 만듭니다.

가족 문서는 나누는 기준도 적어 둡니다.
소스에서 flexbox를 쓰는지가 아니라, 공개된 역할로 나눕니다.
그래서 AspectRatio(자식 하나의 상자를 제약), Card(개별 항목을 담는 표면), AppShell(페이지 셸)은 어느 쪽에도 들지 않습니다.

이 편에서 다루는 컴포넌트를 먼저 표로 봅니다.

| 컴포넌트 | 하는 일 | 눈여겨볼 prop |
| --- | --- | --- |
| Stack, HStack, VStack | 한 방향으로 나열 | `direction`, `gap`, `hAlign`, `vAlign`, `wrap` |
| StackItem | 스택 안 한 항목의 동작 | `size`, `crossAlignSelf`, `isScrollable` |
| Grid, GridSpan | 행과 열로 배치 | `columns`, `gap`, `rowGap`, `columnGap`, `rowHeight` |
| Center | 가운데 정렬 | `axis`, `isInline` |
| AspectRatio | 가로세로 비율 유지 | `ratio`, `fit`, `shape` |
| Section | 페이지 영역 묶기 | `variant`, `padding`, `dividers` |
| Divider | 구분선 | `orientation`, `variant`, `label`, `isFullBleed` |
| ScrollableArea | 스크롤 영역 | `axis`, `label`, `overscroll`, `isFullBleed` |
| `useResizable` + ResizeHandle | 드래그로 크기 조절 | `defaultSize`, `minSize`, `maxSize` |

### Stack, HStack, VStack

Stack은 자식을 한 줄로 나열합니다.
`direction`은 `'vertical'`(기본값)과 `'horizontal'` 두 가지입니다.
문서가 굳이 "`'row'`가 아니다"라고 적어 둔 것을 보면 자주 틀리는 자리입니다.
HStack과 VStack은 방향을 고정해 둔 편의 컴포넌트입니다.

정렬은 `hAlign`과 `vAlign`으로 합니다.
값은 `'start'`, `'center'`, `'end'`, `'between'` 등인데, CSS처럼 `'space-between'`이라고 쓰지 않습니다.
`justify`와 `align`이라는 별칭도 있습니다.

한 항목만 남는 공간을 채우게 하려면 StackItem을 씁니다.

```tsx
import {HStack, VStack, StackItem} from '@astryxdesign/core/Layout';
import {Heading, Text} from '@astryxdesign/core/Text';
import {Button} from '@astryxdesign/core/Button';

function PageTitle() {
  return (
    <HStack gap={3} vAlign="center">
      <StackItem size="fill">
        <VStack gap={1}>
          <Heading level={1}>Incidents</Heading>
          <Text color="secondary">3 investigating</Text>
        </VStack>
      </StackItem>
      <Button label="Declare incident" size="sm" />
    </HStack>
  );
}
```

`size="fill"`인 항목이 남는 폭을 차지하고, 버튼은 제 크기를 지킵니다.
Stack 문서의 권고는 두 가지입니다.
항목 사이 간격은 margin이 아니라 `gap`으로 줄 것.
스택 안에 스택을 겹치기 전에 `wrap="wrap"`으로 줄바꿈을 먼저 시도할 것.

### Grid와 GridSpan

Grid는 CSS 그리드 컨테이너입니다.
핵심은 `columns`에 무엇을 주느냐입니다.

```tsx
// 줄어든다: 넓으면 4열, 좁으면 1열까지 내려간다
<Grid columns={{minWidth: 240, max: 4}} gap={3}>
  {stats.map(stat => <StatCard key={stat.id} {...stat} />)}
</Grid>

// 고정: 어떤 폭에서도 정확히 7열
<Grid columns={7} gap={1}>
  {days.map(day => <DayCell key={day} day={day} />)}
</Grid>
```

숫자는 "모든 폭에서 정확히 N열"이라는 뜻입니다.
공식 문서는 `columns={4}`를 390px 폰에 올리면 100px이 안 되는 열 네 개가 생기고, 내용이 더 줄어들 수 없으면 행이 페이지 밖으로 넘친다고 설명합니다.
숫자는 요일 일곱 칸처럼 열 수가 변하면 안 되는 곳에만 씁니다.

객체에서 `minWidth`는 열의 최소 폭(px), `max`는 열 수의 상한입니다.
`max`를 빼고 `minWidth`만 주면 컨테이너가 `minWidth`보다 좁을 때 넘치므로, 폰까지 가는 화면이라면 둘을 같이 쓰라고 문서는 권합니다.
`repeat`는 `'fill'`(기본값, 빈 트랙을 남겨 폭을 일정하게)과 `'fit'`(빈 트랙을 접어 항목이 늘어남) 가운데 고릅니다.

GridSpan은 한 항목이 여러 열이나 행을 차지하게 합니다.
`columns`에는 숫자나 `'full'`을 줍니다.
줄어드는 그리드에서는 숫자 span이 현재 열 수보다 크면 암시적 열이 생기므로, 가장 적은 열 수 안으로 맞추거나 `'full'`을 쓰라고 문서는 주의를 줍니다.

### Center, AspectRatio, Section, Divider

- **Center**는 빈 상태, 로딩 화면, 로그인 폼처럼 가운데 놓일 내용에 씁니다. 큰 페이지 영역을 Center로 감싸지는 말라고 문서는 적습니다. 그건 Layout이나 AppShell의 일입니다.
- **AspectRatio**는 `ratio={16 / 9}`처럼 숫자를 받습니다. `ratio="16/9"` 같은 문자열은 타입 오류입니다. 폭은 컨테이너에서 받고 높이를 비율로 계산하므로, 폭이 정해진 조상이 있어야 합니다.
- **Section**은 페이지 영역을 묶는 기본 단위입니다. `padding` 기본값은 4이고, `variant`는 `'section'`, `'transparent'`, `'muted'`입니다. 문서는 페이지 섹션에 Card를 쓰고 싶어지면 Section을 쓰라고 못박습니다. Card는 알림 하나, 프로필 하나 같은 개별 항목용입니다.
- **Divider**는 `variant`가 `'subtle'`(기본값)과 `'strong'`이고, `isFullBleed`를 주면 컨테이너 가장자리까지 뻗습니다. 구분선을 남발하지 말고 간격으로 나눌 수 있으면 간격으로 나누라는 권고가 붙어 있습니다.

### ScrollableArea와 Resizable

ScrollableArea는 브라우저의 기본 스크롤을 쓰는 스크롤 영역입니다.
`label`이 필수입니다.
내용이 실제로 넘쳐 스크롤할 수 있을 때만 탭 순서에 들어가고, 그때 키보드 사용자에게 이 이름이 읽히기 때문입니다.
ScrollableArea 바깥에 overflow 래퍼를 하나 더 씌우지 말라는 주의도 있습니다.

크기 조절은 컴포넌트가 아니라 훅이 중심입니다.
`useResizable()`이 크기 상태를 관리하고, ResizeHandle이 드래그 손잡이를 그립니다.
훅의 결과는 LayoutPanel, ResizeHandle, SideNav의 `resizable` prop에 넘깁니다.
패널을 감싸는 래퍼를 따로 만들지 않아도 되도록 한 설계입니다.

## 간격은 왜 숫자 단계인가

Astryx에서 `gap={16}`은 쓸 수 없습니다.
받는 값이 정해져 있습니다.

| 단계 | 0.5 | 1 | 1.5 | 2 | 3 | 4 | 5 | 6 | 8 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 기본 글꼴 크기에서 | 2px | 4px | 6px | 8px | 12px | 16px | 20px | 24px | 32px | 40px |

공식 spacing 문서에 따르면 간격 눈금은 4px을 기본 단위로 하되 rem으로 적혀 있습니다.
한 단계가 0.25rem이라, 사용자가 브라우저 글꼴 크기를 키우면 글자와 함께 간격도 커집니다.
토큰은 0부터 3rem까지 열다섯 개이고, 컴포넌트의 `gap` prop은 그 가운데 위 단계를 받습니다.
값은 `gap={4}`처럼 숫자 표현식으로 넘깁니다. `gap="4"`는 아닙니다.

왜 이렇게 좁혀 놓았을까요.
문서는 눈금에 없는 값이 필요하다면 디자인을 다시 생각해 보라고 말합니다.
선택지가 적으면 화면마다 12px, 14px, 15px이 섞이는 일이 생기지 않습니다.
테마가 간격을 바꿔도 화면 전체가 같이 움직입니다(토큰 자체는 [5편](/blog/astryx-theme-tokens/)에서 다룹니다).

단계가 적다고 모든 간격을 같은 값으로 쓰라는 뜻은 아닙니다.
레이아웃 가이드는 좁은 간격과 넓은 간격의 대비로 묶음을 표현하라고 합니다.

```tsx
<VStack gap={6}>
  <VStack gap={1}>
    <Text weight="semibold">Retention</Text>
    <Text color="secondary">Logs are kept for 30 days</Text>
  </VStack>
  <VStack gap={1}>{/* 다음 항목 */}</VStack>
</VStack>
```

항목 안은 1~2단계로 붙이고, 항목 사이는 4~6단계로 뗍니다.
확인 방법도 적혀 있습니다.
테두리를 전부 지워도 간격만으로 묶음을 짚을 수 있어야 합니다.
짚을 수 없다면 간격이 너무 균일한 것입니다.

픽셀을 써도 되는 곳이 한 군데 있습니다.
사이드바 256px, 패널 380px 같은 구조적 폭입니다.
그 안쪽 간격은 언제나 토큰입니다.

### 컨테이너 패딩 규칙

레이아웃 가이드의 간격 규칙은 한 문장으로 줄일 수 있습니다.
**패딩은 컨테이너가 갖고, 자식은 자기 margin을 0으로 둔다.**

그리고 영역마다 콘텐츠 선(content line)을 하나 정합니다.
글자의 왼쪽 끝이 닿는 세로선입니다.
가이드는 이것을 식으로 적습니다.

`컨테이너 inset = 콘텐츠 선 - 컴포넌트가 원래 가진 inset`

- Text와 Heading은 자체 inset이 없습니다. 컨테이너가 패딩을 전부 가집니다.
- List, Tab, Menu, 내비게이션 항목은 작은 inset을 갖고 있습니다. 컨테이너는 패딩을 내려놓고 컴포넌트가 선을 맞춥니다.
- Table 셀은 inset이 더 큽니다. 마찬가지로 컨테이너가 패딩을 내려놓습니다.

```tsx
// 콘텐츠 선 16px. Heading은 inset이 0이라 Section이 패딩을 갖는다.
<Section padding={4}><Heading level={3}>Members</Heading></Section>

// List와 Table은 inset이 내장돼 있어 Section이 패딩을 내려놓는다.
<Section padding={0}><List>{/* items */}</List></Section>
```

이렇게 하면 글자는 한 선에 맞고, hover나 선택 배경만 그 선을 넘어 가장자리까지 칠해집니다.
가이드가 꼽는 대표적인 실수는 이중 패딩입니다.
Section 제목보다 안쪽으로 한 번 더 들어간 컴포넌트를 말합니다.

### 흔한 오해: padding prop은 CSS padding의 줄임말일 뿐이다

도입에서 본 음수 마진 문제로 돌아가 봅니다.
Astryx에서는 Card 안의 Table이나 `isFullBleed`를 준 Divider가 카드 가장자리까지 알아서 닿습니다.
누가 16px을 기억하고 있는 걸까요.

저장소의 컨테이너 패딩 설계 문서가 이 구조를 설명합니다.
Card, Section, Dialog, BottomSheet, Drawer, ScrollableArea 같은 컨테이너는 자기가 실제로 적용한 inset을 논리적 가장자리별로 후손에게 알려 줍니다.
Layout의 영역들(LayoutHeader, LayoutContent, LayoutFooter, LayoutPanel)도 같은 일을 합니다.
Divider, Table, 그리고 `edge="bleed"`를 준 TabList와 List는 그 값을 읽어 정확히 그만큼만 바깥으로 나갑니다.
컨테이너 패딩이 바뀌면 빠져나가는 양도 같이 바뀝니다.
Dialog 같은 오버레이는 DOM으로는 후손이지만 화면에서는 부모 상자를 벗어나므로, 경계에서 값을 초기화합니다.

여기서 두 가지를 알아 둘 만합니다.

첫째, 이 값을 나르는 CSS 변수는 내부 구현이고 공개 API가 아니라고 문서가 밝힙니다.
앱 코드에서 직접 읽으면 안 됩니다.

둘째, 모든 `padding`이 이 약속에 참여하는 것은 아닙니다.
레이아웃 기본 요소 가족 문서에 따르면 Stack과 Center의 `padding`은 그 상자 안에만 적용되고, 후손에게 inset을 알리지 않습니다.
`<VStack padding={4}>` 안에 넣은 Divider나 Table이 가장자리까지 닿기를 기대하면 안 됩니다.
페이지 영역을 만들 때 `div`나 VStack에 패딩을 주는 대신 Section이나 Layout 영역을 쓰라는 이유가 여기에 있습니다.

## 페이지 뼈대: AppShell과 Layout

레이아웃 가이드(`astryx docs layout`)의 첫 문장은 바깥에서 안으로 만들라는 것입니다.
셸과 영역별 폭을 먼저 정하고, 그다음에 내용을 채웁니다.
내용부터 만들면 섹션마다 제 컨테이너를 발명하게 되고, 카드를 세로로 쌓아 스크롤만 길어지는 화면이 된다고 가이드는 경고합니다.

### AppShell

AppShell은 앱의 가장 바깥 틀입니다.
슬롯은 `topNav`, `sideNav`, `banner`, `mobileNav`, 그리고 본문인 `children`입니다.

AppShell이 대신 해 주는 일이 꽤 많습니다.

- 본문 건너뛰기 링크(skip link)와 `<main>` 랜드마크를 직접 렌더링합니다. 앱에서 `<main>`을 하나 더 만들면 안 됩니다.
- 모바일 중단점 아래에서는 내비게이션 슬롯의 내용으로 서랍(MobileNav)을 자동으로 만듭니다.
- `height`가 `'fill'`(기본값)이면 뷰포트 높이(100dvh)를 채우고 영역별로 따로 스크롤합니다. `'auto'`면 내용만큼 자라고 내비게이션은 sticky로 붙습니다.

`contentPadding`의 기본값은 0입니다.
문서는 내용 유형에 따라 고르라고 권합니다.
폼, 설정, 글 위주면 4(16px), 대시보드, 지도, 표면 0입니다.

AppShell 안에 AppShell을 넣지 않습니다.
페이지 안쪽 구획에는 Layout을 씁니다.

### Layout과 다섯 슬롯

Layout은 다섯 슬롯을 가진 범용 레이아웃입니다.
`header`, `start`, `content`, `end`, `footer`.
`start`와 `end`는 논리적 방향이라 LTR에서는 왼쪽과 오른쪽이고 RTL에서는 반대가 됩니다.
슬롯에는 아무 ReactNode나 넣을 수 있지만, 보통 짝이 되는 영역 컴포넌트를 넣습니다.

| 슬롯 | 영역 컴포넌트 | 용도 |
| --- | --- | --- |
| `header` | LayoutHeader | 페이지 제목, 주요 액션 |
| `start`, `end` | LayoutPanel | 페이지 안 내비게이션, 필터, 상세 패널 |
| `content` | LayoutContent | 스크롤되는 본문 |
| `footer` | LayoutFooter | 저장·취소, 페이지네이션, 상태 줄 |

공식 문서의 예시를 줄이면 이렇습니다.

```tsx
import {AppShell} from '@astryxdesign/core/AppShell';
import {SideNav, SideNavItem} from '@astryxdesign/core/SideNav';
import {Layout, LayoutHeader, LayoutContent, LayoutPanel, VStack} from '@astryxdesign/core/Layout';
import {Heading, Text} from '@astryxdesign/core/Text';

function OrdersPage() {
  return (
    <AppShell
      sideNav={
        <SideNav>
          <SideNavItem label="Orders" isSelected />
          <SideNavItem label="Customers" />
        </SideNav>
      }>
      <Layout
        header={
          <LayoutHeader hasDivider>
            <Heading level={1}>Orders</Heading>
          </LayoutHeader>
        }
        content={
          <LayoutContent>
            <Text>Select an order to see its details.</Text>
          </LayoutContent>
        }
        end={
          <LayoutPanel hasDivider width={320} role="complementary" label="Order details">
            <VStack gap={2}>
              <Heading level={2}>Order #1042</Heading>
              <Text color="secondary">Shipped · 3 items</Text>
            </VStack>
          </LayoutPanel>
        }
      />
    </AppShell>
  );
}
```

몇 가지 동작을 짚어 둡니다.

- **슬롯 숨기기**: 슬롯에 `false`, `null`, `undefined`를 넘기면 빈 것으로 치고, 이웃 영역이 가장자리까지 넓어집니다. `isOpen && <LayoutPanel />` 같은 조건부 렌더링이 그대로 통합니다.
- **높이**: `height`는 `'fill'`(기본값)과 `'auto'`입니다. `'fill'`은 높이가 정해진 컨테이너 안에서만 뜻이 있습니다. AppShell의 본문 영역이 그런 곳입니다.
- **패딩**: Layout에 `padding`을 주면 header, content, footer, 패널에 함께 적용됩니다. 주지 않으면 영역들은 기본 inset(간격 4단계)을 씁니다. 그래서 AppShell의 `contentPadding`이 0이어도 그 안의 페이지 Layout은 안쪽 여백을 유지합니다.
- **최대 폭**: `contentWidth`는 각 슬롯 안 내용의 최대 폭입니다. 문서가 드는 흔한 값은 폼·설정·글 위주 페이지에 640, 일반 콘텐츠 페이지에 960입니다. 구분선은 폭 제한과 상관없이 끝까지 그어집니다.
- **랜드마크**: Layout은 role이나 이름을 스스로 붙이지 않습니다. 페이지 랜드마크가 되어야 하는 영역에는 `role`과 `label`을 직접 줍니다.

### 내비게이션 고르기

scaffold 가이드는 어떤 내비게이션을 쓸지 이렇게 정리합니다.

| 선택 | 맞는 경우 |
| --- | --- |
| SideNav (기본) | 그룹이 필요하다, 항목이 늘어날 수 있다, 접을 수 있어야 한다. 트래커, 콘솔, 설정이 대개 여기서 시작 |
| TopNav | 얕고 앞으로도 얕을 내비게이션, 필터와 컨트롤이 많은 페이지 |
| 둘 다 | 여러 제품을 묶은 스위트. TopNav가 전역 검색과 컨텍스트 전환을, SideNav가 제품 내비게이션을 맡는다 |
| 둘 다 없음 | 메신저, 피드처럼 기둥 여러 개로 이뤄진 화면 |

컴포넌트 문서의 기준도 같은 방향입니다.
TopNav는 늘 보이는 항목 5개 이하에, SideNav는 목적지가 5개 이상이거나 계층이 필요할 때 씁니다.
TopNav는 `heading`, `startContent`, `centerContent`, `endContent` 슬롯을, SideNav는 `header`, `topContent`, `children`, `footer`, `footerIcons` 다섯 구역을 가집니다.
SideNav의 접기는 AppShell이 아니라 SideNav의 `collapsible` prop으로 설정합니다.

가이드는 영역별 권장 폭도 제시합니다.
SideNav 240~280px, 아이콘 레일 64~72px, 사이드 패널 340~420px, 필터 레일 220~260px.
정해진 답이 아니라 출발점입니다.

## 헤더·푸터와 사이드 패널

본문이 스크롤되는 동안 제목 줄과 저장 버튼 줄을 고정하고 싶다면 Layout의 `header`와 `footer` 슬롯을 씁니다.

```tsx
<Layout
  padding={4}
  defaultHasDividers
  header={<LayoutHeader>{/* 제목과 주요 액션 */}</LayoutHeader>}
  content={<LayoutContent>{/* 행 */}</LayoutContent>}
  footer={<LayoutFooter>{/* 저장, 취소 */}</LayoutFooter>}
/>
```

`defaultHasDividers`는 헤더와 푸터의 구분선을 한 번에 켭니다.
슬롯마다 `hasDivider`를 주는 것보다 낫다고 가이드는 권합니다.
패딩을 Layout에 한 번만 줬기 때문에 세 영역의 글자가 같은 세로선에 맞습니다.
헤더가 버튼과 필터 같은 조작 요소를 담는다면 LayoutHeader 대신 Toolbar를 쓰라는 안내도 있습니다.

사이드 패널은 목록에서 행을 고르면 옆에 상세가 열리는 마스터-디테일 구조에 씁니다.
LayoutPanel을 `start`나 `end` 슬롯에 넣고 폭을 고정합니다.

```tsx
<Layout
  content={<LayoutContent>{/* 행 */}</LayoutContent>}
  end={
    <LayoutPanel width={380} hasDivider isScrollable label="Details">
      {/* 상세, 선택된 것이 없으면 EmptyState */}
    </LayoutPanel>
  }
/>
```

가이드가 강조하는 점은 두 가지입니다.

- 아무것도 선택되지 않았을 때는 EmptyState를 그려서 영역이 무너지지 않게 합니다.
- 사용자가 폭을 조절하게 하려면 `useResizable()`과 ResizeHandle을 패널의 안쪽 가장자리에 붙입니다. 이때 구분선은 손잡이가 그리므로 패널에는 `hasDivider={false}`를 줍니다. 두 영역 사이에 선을 긋는 요소는 하나여야 합니다.

LayoutPanel의 `hasDivider`는 Layout의 `defaultHasDividers`를 따르지 않는다는 점도 문서에 적혀 있습니다.
패널 구분선은 패널에서 직접 켭니다.

## 반응형: 영역마다 계약을 적는다

Astryx에는 "화면이 좁아지면 패널이 알아서 사라지는" 기능이 없습니다.
레이아웃 영역 가족 문서가 이 점을 분명히 적어 둡니다.
Layout은 넘겨받은 영역을 그릴 뿐이고, 좁은 폭에서 어떤 영역을 빼거나 바꿀지는 AppShell이나 앱 코드가 정합니다.

대신 가이드는 영역마다 반응형 계약(responsive contract)을 적으라고 합니다.
폭이 변할 때 영역이 할 수 있는 일은 네 가지입니다.

- **나누기(divide)**: 각 폭에서 영역이 몇 개 살아남는가
- **드러내기(reveal)**: 자리가 있을 때만 보이고, 없으면 필요할 때 여는 영역은 무엇인가
- **크기 조절(resize)**: 본문은 늘고 줄며, 고정 영역은 제 폭을 지킨다
- **바꾸기(swap)**: 내비게이션은 MobileNav로, 사이드 패널은 Dialog나 BottomSheet로 바뀐다

그리고 계약의 각 줄을 그것을 실제로 강제하는 prop이나 훅과 짝짓습니다.

```tsx
// >1024   SideNav | 본문 | 사이드 패널 380
// <=1024  패널은 빼고 다른 방식으로 연다   (useMediaQuery)
// 더 좁으면 내비게이션이 MobileNav로 접힌다 (mobileNav breakpoint)
const isNarrow = useMediaQuery('(max-width: 1024px)');

<AppShell sideNav={<SideNav />} mobileNav={{breakpoint: 'md'}}>
  <Layout
    content={<LayoutContent>{/* 행 */}</LayoutContent>}
    end={isNarrow ? undefined : <LayoutPanel width={380} hasDivider />}
  />
</AppShell>
```

가이드가 권하는 기준은 1024px 위에서 영역 셋, 768px부터 둘, 그 아래 하나입니다.
세 영역 모두를 균일하게 줄이는 것보다 하나를 빼는 편이 낫다고 합니다.

AppShell의 `mobileNav`는 `false`(끄기), 설정 객체, 또는 직접 만든 서랍(ReactNode)을 받습니다.
설정 객체의 `breakpoint`는 `'sm'`, `'md'`, `'lg'`, `'xl'`, `'2xl'`, `'none'` 가운데 하나이고 기본값은 `'md'`입니다.
실제 폭은 가장 가까운 Theme의 `widthBreakpoints`에서 정해집니다.
중단점을 넘나들어도 본문은 다시 마운트되지 않아 상태가 유지된다는 점이 가족 문서에 적혀 있습니다.

서랍을 직접 여닫아야 한다면 `useAppShellMobile()` 훅을 씁니다.
`isMobile`, `isMobileNavOpen`, `toggleMobileNav`, `closeMobileNav` 등을 돌려줍니다.
라우트가 바뀐 뒤 서랍을 닫는 처리가 대표적인 쓰임입니다.
표준 햄버거 버튼만 필요하면 MobileNavToggle이 있습니다.

열 수가 줄어드는 그리드는 앞에서 본 `columns={{minWidth, max}}`로 해결합니다.
여기에는 미디어 쿼리가 필요 없습니다.

## 템플릿이란 무엇인가

여기까지가 부품이고, 이제부터는 조립된 화면을 봅니다.

Astryx 문서는 템플릿을 컴포넌트와 이렇게 구분합니다.
컴포넌트는 패키지 의존성으로 남아서 패키지와 함께 업데이트됩니다.
템플릿은 앱이 자기 코드 안으로 복사해서 제품에 맞게 고치는 출발점입니다.
복사한 뒤에는 앱의 코드이므로, 패키지를 올려도 그 사본은 다시 쓰이지 않습니다.

종류는 두 가지뿐입니다.

| 종류 | 쓰임 | 저장소에서의 모양 |
| --- | --- | --- |
| 페이지(page) | 대시보드, 설정, 결제 흐름 같은 완성된 한 화면 | `pages/<slug>/page.tsx` + `template.doc.mjs` |
| 블록(block) | 페이지 안에 들어가는 작은 구획. 컴포넌트의 예시나 쇼케이스 역할도 한다 | `blocks/` 아래 `<Name>.tsx` + `<Name>.doc.mjs` |

템플릿마다 소스 파일과 문서 파일이 한 쌍입니다.
문서 파일(`*.doc.mjs`)에는 이름, 설명, 검색 키워드, 카테고리, `isReady` 같은 메타데이터가 들어 있고, CLI의 목록과 검색이 이것을 읽습니다.
페이지 템플릿의 CLI id는 폴더 이름입니다.
v0.7.16 무렵 저장소 파일 목록 기준으로 페이지 폴더는 58개, 블록 소스 파일은 730개가량입니다.

### 템플릿은 콘텐츠만 담고, 앱 크롬은 직접 감싼다

템플릿 설계 문서에는 이런 불변 조건이 있습니다.
보통의 페이지 템플릿은 페이지 콘텐츠를 가질 뿐, 호스트 앱의 전역 크롬은 갖지 않는다.
전역 크롬이란 사이드바, 상단 바처럼 모든 페이지가 공유하는 틀입니다.

예외는 카테고리가 `Shell -`로 시작하는 템플릿입니다.
그 크롬을 보여 주는 것이 목적이므로 AppShell과 전역 내비게이션을 가질 수 있습니다.

실제로 `dashboard` 템플릿의 루트는 AppShell이 아니라 Layout입니다.

```tsx
export default function DashboardTemplate() {
  return (
    <Layout
      height="fill"
      content={
        <LayoutContent role="main" padding={6}>
          {/* 차트, 지표 카드, 표 */}
        </LayoutContent>
      }
    />
  );
}
```

처음 보면 "사이드바가 왜 없지" 싶지만 의도한 설계입니다.
여러분의 앱에는 이미 내비게이션이 있을 것이고, 대시보드 템플릿이 사이드바까지 들고 오면 지워야 할 코드만 늘어납니다.
아직 틀이 없다면 `shell-side-nav` 같은 Shell 템플릿으로 틀을 먼저 만들고, 그 본문 자리에 페이지 템플릿을 넣으면 됩니다.

## 제공되는 페이지 템플릿

`packages/cli/assets/templates/pages` 아래 폴더 58개를 문서 파일의 `category` 값 기준으로 묶었습니다.
카테고리는 `{그룹} - {변형}` 꼴입니다(예: `Dashboard - Monitoring`).

| 계열 | 수 | 템플릿 id | 특징 |
| --- | --- | --- | --- |
| Dashboard | 7 | `dashboard`, `dashboard-comparison`, `dashboard-cohort-funnel`, `dashboard-alert-rail`, `dashboard-composition`, `dashboard-progress`, `dashboard-scorecard` | 분석 요약, 기간 비교, 퍼널·코호트, 서비스 모니터링, 구성 추이, 프로젝트 현황, 경영 요약 |
| Table | 8 | `table`, `table-page`, `table-filter`, `table-grouped`, `table-collapsible`, `table-comparison`, `table-inbox`, `table-tree` | 기본 표, 검색 표, 필터 중심, 그룹 접기, 스키마가 다른 표 여럿, 비교 매트릭스, 받은편지함식 2분할, 트리 |
| Form | 8 | `contact-form`, `form-two-column`, `payment-form`, `checkout-wizard`, `form-wizard`, `form-wizard-vertical`, `form-wizard-inline`, `form-wizard-dialog` | 단일 폼, 2열 폼, 결제 폼, 그리고 마법사 다섯 가지(가로 진행, 세로 레일, 아코디언, 다이얼로그, 결제) |
| Login | 4 | `login`, `login-card`, `login-split`, `login-sso` | 최소형, 카드형, 화면 분할형, SSO 분기형 |
| Settings | 3 | `settings`, `settings-sidebar`, `settings-dialog` | 한 줄로 스크롤되는 폼, 패널 전환, 모달 안 설정 |
| Gallery | 6 | `classic-gallery`, `mixed-gallery`, `product-gallery`, `side-gallery`, `centered-hero`, `gallery-hero` | 균일 그리드, 메이슨리, 상품 카드, 비대칭 분할, 히어로 |
| Content | 8 | `library`, `course-detail`, `detail-page`, `product-detail`, `work-item-detail`, `documentation`, `documentation-design`, `documentation-technical` | 카드 라이브러리, 상세 페이지(강의, 주문, 상품, 작업 항목), 문서(목차형, 디자인 문서, 단계별 기술 문서) |
| AI Chat | 2 | `ai-chat`, `ai-chat-landing` | 대화 기록과 크기 조절되는 결과물 패널, 대화 전 빈 화면 |
| Tools | 6 | `ide`, `editor`, `canvas-editor`, `file-explorer`, `kanban-board`, `incident-console` | 다중 창 IDE, 블록 편집기, 캔버스 편집기, 파일 탐색기, 칸반, 장애 대응 콘솔 |
| Shell | 6 | `blank`, `shell-side-nav`, `shell-top-nav`, `shell-nav`, `messaging-shell`, `theme-showcase` | 빈 틀, 측면 내비, 상단 내비, 둘 다, 메신저 틀, 테마 미리보기 |

몇 가지 덧붙입니다.

- `messaging-shell`은 문서 파일에 `isReady: false`로 표시돼 있습니다. 아직 완성으로 치지 않는다는 뜻입니다.
- `blank`는 `scaffold: true`인 일부러 비워 둔 출발점입니다.
- `login`, `table`, `theme-showcase`는 문서 사이트 개요에서 숨기는 표시(`isHiddenFromOverview`)가 붙어 있지만 템플릿으로는 존재합니다.
- 템플릿 id와 카테고리, 예제 데이터는 바뀔 수 있는 카탈로그 값이라고 설계 문서가 밝힙니다. 안정적으로 유지하겠다는 대상은 `template` 명령과 그 옵션, 응답 형식입니다. 그러니 목록은 이 표가 아니라 설치한 버전의 `astryx template --list`를 기준으로 삼는 편이 맞습니다.

## CLI로 템플릿 쓰기

템플릿은 CLI의 `template` 명령 하나로 다룹니다(CLI 전체는 [7편](/blog/astryx-cli/)에서 다룹니다).
아래는 CLI를 프로젝트에 설치했거나 전역 설치했다고 보고 `astryx`로 적습니다.
설치 전에는 `npx @astryxdesign/cli template --list`처럼 스코프가 붙은 패키지 이름으로 실행해야 합니다.
CLI README는 npm의 `astryx`라는 이름이 관계없는 다른 패키지라고 경고합니다.

| 하려는 일 | 명령 |
| --- | --- |
| 전체 목록 | `astryx template --list` |
| 페이지만 | `astryx template --list --type page` |
| JSON으로 | `astryx --json template --list` |
| 소스 출력(쓰지 않음) | `astryx template dashboard` |
| 구조만 보기 | `astryx template dashboard --skeleton` |
| 프로젝트에 복사 | `astryx template dashboard ./src/app` |
| 기존 파일 덮어쓰기 | `astryx template dashboard ./src/app --overwrite` |

### `astryx template --list`

이름 없이 실행하면 찾아낸 템플릿을 나열합니다.
`--type page` 또는 `--type block`으로 좁히고, `--package <패키지>`로 특정 패키지의 것만 볼 수 있습니다.
`--list`는 목록만 냅니다. 이름, 경로, `--skeleton`, `--overwrite`와 함께 쓰면 거부됩니다.

찾는 것이 템플릿인지 컴포넌트인지 모를 때는 `astryx search`가, 만들 화면을 말로 설명할 수 있을 때는 `astryx build "analytics dashboard"`가 낫습니다.
`build`는 출발점으로 삼을 페이지 템플릿 하나와 차선 두 개, 그 주변에 쓸 블록과 컴포넌트를 함께 알려 줍니다.

### `astryx template <이름> [경로]`

경로를 생략하면 소스를 출력만 합니다.
경로를 주면 그곳에 복사합니다.

경로 규칙은 문서에 이렇게 적혀 있습니다.
`.tsx`, `.ts`, `.jsx`, `.js` 같은 확장자로 끝나면 그 파일에 씁니다.
그 밖의 경로는 디렉터리로 보고, 페이지 템플릿이면 그 안에 `page.tsx`를, 블록이면 블록 자신의 파일 이름으로 씁니다.
Next.js App Router라면 `astryx template dashboard src/app/dashboard`가 곧 `/dashboard` 라우트 파일이 됩니다.

프로젝트 밖 경로는 거부됩니다(시스템 임시 폴더는 예외로, 임시 사본을 만듭니다).
이미 파일이 있으면 `ERR_FILE_EXISTS`로 거부되고, `-f` 또는 `--overwrite`를 줘야 덮어씁니다.

복사 결과에는 영수증이 따라옵니다.
CLI README의 응답 형식 설명에 따르면 여기에는 쓴 파일, 템플릿이 import하는데 프로젝트에 없는 패키지(`missingPackages`), 감지한 패키지 매니저로 만든 설치 명령(`installCommand`), 그리고 StyleX 컴파일러가 없다는 식의 설정 안내(`notes`)가 담깁니다.
저장소 전용 데모 이미지는 복사할 때 자리 표시자로 바뀌고, 몇 개를 바꿨는지도 알려 줍니다(`demoMediaReplaced`).

### `--skeleton`

1,000줄짜리 템플릿을 통째로 읽기 전에 뼈대만 보고 싶을 때 씁니다.
소스 대신 레이아웃 골격을 출력합니다.
아무것도 쓰지 않으므로 경로나 `--overwrite`와 함께 주면 `ERR_INVALID_ARGUMENT`로 거부됩니다.

CLI 소스를 보면 골격은 이렇게 만들어집니다.
기본 내보내기 컴포넌트의 `return` 안에서 AppShell, Layout과 그 영역들, Card, Section, Grid, List, Table, Toolbar, SideNav, TopNav 같은 구조 컴포넌트만 남깁니다.
거기에 `padding`, `contentPadding`, `gap`, `columns`, `hasDivider`, `density`, `height`, `width` 같은 공간 관련 prop을 그대로 붙입니다.
`header`, `content`, `end` 같은 슬롯 이름은 주석으로 표시됩니다.
출력은 수십 줄로 제한됩니다.

사람이 훑어보기에도 좋지만, 코드 에이전트가 적은 토큰으로 구조를 파악하게 하려는 용도가 큽니다(에이전트 이야기는 [8편](/blog/astryx-ai-agents/)에서 다룹니다).

## 템플릿을 내 프로젝트에 맞게 고치는 흐름

공식 문서와 템플릿 소스를 종합하면 흐름은 이렇습니다.

1. **고른다.** `astryx build "<만들 화면>"`이나 `astryx template --list --type page`로 후보를 찾고, 설명을 읽습니다. 설명은 "언제 이 템플릿이고 언제 형제 템플릿인가"를 가르도록 쓰여 있습니다.
2. **뼈대를 본다.** `--skeleton`으로 영역 구성과 패딩을 확인합니다.
3. **복사한다.** 라우트가 될 경로를 줍니다.
4. **빠진 의존성을 채운다.** 영수증의 `installCommand`를 실행합니다. 읽어 본 템플릿들은 아이콘에 `@heroicons/react`를, 대시보드 계열은 차트에 `recharts`를 import합니다. `dashboard-alert-rail`처럼 `@stylexjs/stylex`로 직접 쓴 스타일이 든 템플릿도 있습니다.
5. **앱 크롬 안에 넣는다.** 페이지 템플릿의 루트는 대개 `<Layout height="fill">`입니다. `'fill'`은 높이가 정해진 부모가 있어야 하므로, AppShell의 본문 영역 안에 놓습니다.
6. **데모를 실제로 바꾼다.** 예제 데이터를 API 응답으로 바꿉니다. 버튼 핸들러에는 "데모용이니 실제 동작으로 바꾸라"는 주석과 함께 토스트가 들어 있습니다. 이 자리가 곧 연결할 곳의 목록입니다.
7. **반응형 계약을 확인한다.** `incident-console`이나 `dashboard-alert-rail`은 파일 맨 위 주석에 영역 구성과 폭별 동작을 적어 두었습니다. 영역을 더하거나 빼면 이 주석과 `useMediaQuery` 조건을 함께 고칩니다.
8. **점검한다.** `astryx docs is-my-code-good`의 기준으로 봅니다. 레이아웃용 `div`를 새로 만들지 않았는지, 간격에 픽셀 값을 넣지 않았는지가 핵심입니다.

`table-page`처럼 소스 주석에 "이 템플릿을 확장하는 법"을 길게 적어 둔 템플릿도 있습니다.
검색창, 범위 토글, 열별 필터가 각각 어떤 질문에 답하는지, 셋을 반사적으로 다 넣으면 왜 안 되는지를 설명합니다.
복사한 뒤 지우기 전에 한 번 읽어 볼 만합니다.

## 좋은 템플릿의 기준: 공식 채점표

"좋은 템플릿"이 무엇인지 Astryx는 숫자로 적어 두었습니다.
`template-grading-rubric` 문서, 작성 시점 기준 버전 1.4입니다.
일곱 항목, 합계 100점입니다.

| 항목 | 배점 | 보는 것 |
| --- | --- | --- |
| Astryx 컴포넌트 순도 | 30 | 날 HTML 요소의 수. 0개면 만점, 21개 이상이면 0점 |
| 아이콘 순도 | 15 | 날 SVG로 그린 아이콘의 수 |
| 커스텀 CSS | 15 | `stylex.create`, 인라인 `style`, `className`으로 직접 쓴 스타일 선언의 수 |
| 레이아웃과 구조 | 15 | 루트가 맞는가, 그리드가 줄어드는가, 한 파일이 한 페이지인가 |
| 문서 메타데이터 | 10 | 필드 정확성 6, 설명 3, 이름 1 |
| 이미지 처리 | 5 | 복사 뒤에도 이미지가 동작하는가 |
| 코드 품질 | 10 | 클라이언트 경계, 기본 내보내기, 자족적인 import, 현실적인 예제 데이터, 죽은 코드 없음 |

등급은 A(90~100), B(75~89), C(60~74), D(40~59), F(0~39)입니다.
B(75점)가 공개 하한선이고, 문서는 이것이 목표가 아니라 바닥이라고 적습니다.
점수와 무관하게, 복사한 파일이 빌드되지 않거나 필요한 자산이 빠지면 준비된 것이 아닙니다.

채점표에서 레이아웃 규칙을 다시 확인할 수 있습니다.
`Shell -` 카테고리만 AppShell을 루트로 쓰고, 나머지 페이지는 Layout이나 Center를 루트로 씁니다.
블록은 AppShell로 감싸지 않고, 한 가지 패턴에 집중하며, 대략 20~100줄이 보통 범위입니다.

점수 밖의 기준도 있습니다.
`write-good-templates` 문서는 390px 폭 창에서 가로 넘침이 없어야 하고, 지원하는 모든 색 모드에서 위계와 간격이 유지돼야 한다고 적습니다.
예제 내용은 넘침과 빈 공간 문제가 드러날 만큼 현실적이어야 합니다.

이 채점표는 템플릿을 만드는 사람을 위한 것이지만, 복사해 온 템플릿을 고치는 사람에게도 쓸모가 있습니다.
고치다 보면 `div`와 인라인 스타일이 늘어나기 마련인데, 어디까지가 괜찮은지 가늠할 눈금이 됩니다.

## 템플릿을 직접 만들어 배포하기

팀의 대시보드 틀을 여러 앱이 공유해야 한다면 템플릿으로 배포할 수 있습니다.
Astryx에서는 이것을 통합 패키지(integration package)에 담습니다.
개요만 적습니다.

```bash
# 페이지 템플릿 추가 (기본이 page)
astryx integration add template acme-dashboard
# 블록 템플릿 추가
astryx integration add template acme-stat-card --type block
```

이 명령은 `templates/<id>.tsx`와 `templates/<id>.doc.mjs`를 만들고, `astryx.integration.mjs`에 템플릿 디렉터리를 선언합니다.
기존 파일은 덮어쓰지 않고, `--dry-run`으로 쓸 내용을 미리 볼 수 있습니다.

문서가 정한 규칙 가운데 기억할 것은 이 정도입니다.

- **id**는 소문자 kebab-case이고, 제품이나 패키지 이름으로 시작합니다. `-page`, `-app`, `-view`, `-screen`으로 끝내지 않습니다. 이름표를 바꾸고 싶으면 문서 파일을 고치고, id는 바꾸지 않습니다.
- Core와 같은 id를 실수로 쓰면 그 id가 모호해져서, 앱에서 `--package`를 붙여야만 명령이 동작합니다. Core 템플릿을 일부러 대체하려면 `replaces`를 선언합니다.
- 문서 파일을 만들자마자 `isReady: false`를 넣습니다. 이 필드가 없으면 준비된 것으로 나열되기 때문입니다.
- 페이지에는 가장 구체적인 `category`를 주고, 블록에는 `aspectRatio`와 `componentsUsed`를 적습니다.
- 배포 전에는 패키징한 패키지를 깨끗한 앱에 설치하고, 템플릿을 복사하고, 타입 검사와 프로덕션 빌드를 돌립니다. 복사한 블록은 실제 페이지에서 import해 봐야 테스트한 것입니다.

"제품 전용 페이지의 구조만 공유하려고 그것을 딱딱한 컴포넌트로 만들지 말라"는 문장이 문서에 있습니다.
구조를 공유하고 싶으면 템플릿으로 내놓고, 앱마다 사본을 고치게 하라는 뜻입니다.
페이지 전체를 props 수십 개짜리 컴포넌트로 만들어 본 팀이라면 무슨 말인지 알 겁니다.

## 관제·대시보드 화면이라면 어디서 출발할까

실시간 상태를 보고 이상을 처리하는 화면을 만든다고 하면, 58개 가운데 다음 템플릿이 출발점으로 쓸 만합니다.

| 만들 화면 | 출발 템플릿 | 이유 |
| --- | --- | --- |
| 지표와 알림을 함께 보는 상황판 | `dashboard-alert-rail` | 헤더(전역 컨트롤), 본문(KPI·차트), 폭 400의 알림 레일. 레일은 따로 스크롤되고 1024px 아래에서 본문 안으로 접힌다 |
| 이벤트·장애 목록을 처리하는 콘솔 | `incident-console` | 상태별로 묶인 행, 검색 필터, 크기 조절되는 380px 상세 패널. 좁은 화면에서는 상세가 BottomSheet로 열린다 |
| 요약 위주의 현황판 | `dashboard` | 지표 타일, 차트, 보조 표의 3단 구성 |
| 필터가 핵심인 목록 | `table-filter` | 토큰 필터, 저장된 보기, 크기 조절되는 상세 패널 |
| 앱 틀 | `shell-side-nav`, `shell-nav` | 접히고 폭 조절되는 측면 내비, 또는 상단 바와 측면 내비 조합 |

`incident-console`의 소스 주석에는 설계 의도가 적혀 있습니다.
밀도 높은 데이터는 카드가 아니라 행으로 그리고, 상태는 장식용 배지 대신 StatusDot과 Token으로 표시합니다.
레이아웃 가이드가 "카드 수프(Card soup)"라고 부르는 것, 곧 레코드마다 카드를 씌우는 방식을 피한 예입니다.
자주 훑어보는 로그나 모니터 영역에는 compact 밀도를 쓰라는 가이드와도 맞닿습니다.

지도를 중심에 둔 템플릿은 목록에 없으므로, 지도 관제 화면이라면 틀을 직접 짜야 합니다.
AppShell에 `contentPadding={0}`(문서가 대시보드·지도·표에 권하는 값)을 주고, Layout의 `content`에 지도를, `end`에 LayoutPanel을 두는 구성이 자연스럽습니다.
패널 쪽은 `incident-console`의 상세 패널과 BottomSheet 전환 코드를 참고할 수 있습니다.

## 자주 묻는 질문

### AppShell과 Layout은 어떻게 다른가요?

AppShell은 앱의 가장 바깥 틀이고 상단·측면 내비게이션, 배너, 모바일 서랍, `<main>` 랜드마크, 본문 건너뛰기 링크를 맡습니다.
Layout은 header, start, content, end, footer 다섯 슬롯으로 페이지나 그 안의 한 구획을 나눕니다.
AppShell은 중첩하지 않고, 페이지 안쪽 구획에는 Layout을 씁니다.
단순히 위아래나 좌우로 쌓기만 한다면 Layout도 과하고 VStack이나 HStack이면 됩니다.

### 템플릿을 복사한 뒤 Astryx를 업그레이드하면 템플릿도 바뀌나요?

바뀌지 않습니다.
복사는 그 시점의 스냅샷이고, 이후 카탈로그가 바뀌어도 복사된 프로젝트를 고치지 않는다고 설계 문서에 적혀 있습니다.
템플릿이 쓰는 컴포넌트는 패키지 의존성이므로 업그레이드의 영향을 받습니다.
컴포넌트 API가 바뀐 경우의 코드 수정은 `astryx upgrade`의 몫이고, [7편](/blog/astryx-cli/)에서 다룹니다.

### 대시보드 템플릿에 사이드바가 없는 이유는 무엇인가요?

`Shell -` 계열이 아닌 페이지 템플릿은 페이지 콘텐츠만 담도록 정해져 있기 때문입니다.
전역 내비게이션은 호스트 앱의 것이므로, 템플릿은 Layout을 루트로 삼고 AppShell은 쓰는 쪽에서 감쌉니다.
틀까지 필요하면 `shell-side-nav`, `shell-top-nav`, `shell-nav`를 먼저 복사합니다.

### 템플릿을 쓰려면 Astryx 말고 무엇을 더 설치해야 하나요?

템플릿마다 다릅니다.
읽어 본 템플릿들은 `@heroicons/react`를, 대시보드 계열은 `recharts`를 import합니다.
복사 영수증의 `missingPackages`와 `installCommand`가 프로젝트에 없는 패키지를 알려 주므로 그것을 따르면 됩니다.

### 화면이 좁아지면 사이드 패널이 자동으로 숨겨지나요?

자동으로 숨겨지지 않습니다.
AppShell의 내비게이션은 중단점 아래에서 MobileNav 서랍으로 바뀌지만, Layout의 패널은 넘겨준 대로 그려집니다.
`useMediaQuery`로 조건을 만들어 슬롯에 `undefined`를 넘기고, 필요하면 Dialog나 BottomSheet로 대신 여는 코드를 직접 씁니다.

### 저장소의 docs/templates 폴더가 페이지 템플릿인가요?

아닙니다.
`docs/templates/knowledge`에는 설계 문서(아키텍처, 컴포넌트 명세, 가족 계약 등)를 쓸 때의 양식이 들어 있습니다.
UI 템플릿은 `packages/cli/assets/templates`의 `pages`와 `blocks` 아래에 있습니다.

## 정리

- Astryx의 레이아웃은 배치용 기본 요소(Stack, Grid, Center)와 구조적 영역(Section, Layout, Toolbar), 그리고 앱 틀인 AppShell로 나뉩니다. 바깥에서 안으로, 틀과 폭을 먼저 정하고 내용을 채웁니다.
- 간격은 열한 개 단계만 받습니다. 패딩은 컨테이너가 갖고, Card·Section·Layout 영역은 자기 inset을 후손에게 알려서 Table과 Divider가 음수 마진 없이 가장자리에 닿게 합니다. Stack의 padding은 이 약속에 들지 않습니다.
- 반응형에 자동은 거의 없습니다. Grid는 `{minWidth, max}`로 줄어들고, 내비게이션은 AppShell이 서랍으로 바꾸지만, 패널을 빼고 바꾸는 일은 영역별 계약을 적고 직접 구현합니다.
- 템플릿은 의존성이 아니라 복사되는 코드입니다. 페이지 템플릿은 콘텐츠만 담고, 앱 크롬은 AppShell로 직접 감쌉니다.
- `astryx template --list`, `<이름> --skeleton`, `<이름> <경로>` 세 가지면 찾기, 훑기, 복사가 끝납니다.
- 베타라서 템플릿 id와 구성은 바뀔 수 있습니다. 이 글에서 인용한 설계 문서 일부(템플릿 구성, 공간 위계, 템플릿 저작 구조)는 아직 초안(draft) 단계입니다.

## 참고

레이아웃과 간격

- [docs/families/layout-primitives.md](https://github.com/meta/astryx/blob/main/docs/families/layout-primitives.md)
- [docs/families/layout-regions.md](https://github.com/meta/astryx/blob/main/docs/families/layout-regions.md)
- [docs/architecture/container-padding.md](https://github.com/meta/astryx/blob/main/docs/architecture/container-padding.md)
- [docs/design/spatial-hierarchy.md](https://github.com/meta/astryx/blob/main/docs/design/spatial-hierarchy.md)
- [packages/cli/assets/docs/spacing.doc.mjs](https://github.com/meta/astryx/blob/main/packages/cli/assets/docs/spacing.doc.mjs)
- 레이아웃 가이드: [layout](https://github.com/meta/astryx/blob/main/packages/cli/assets/docs/tree/layout.doc.mjs), [scaffold](https://github.com/meta/astryx/blob/main/packages/cli/assets/docs/tree/scaffold.doc.mjs), [structure](https://github.com/meta/astryx/blob/main/packages/cli/assets/docs/tree/structure.doc.mjs), [headers-and-footers](https://github.com/meta/astryx/blob/main/packages/cli/assets/docs/tree/headers-and-footers.doc.mjs), [side-panels](https://github.com/meta/astryx/blob/main/packages/cli/assets/docs/tree/side-panels.doc.mjs), [layout-spacing](https://github.com/meta/astryx/blob/main/packages/cli/assets/docs/tree/layout-spacing.doc.mjs), [responsive](https://github.com/meta/astryx/blob/main/packages/cli/assets/docs/tree/responsive.doc.mjs)

컴포넌트 문서

- [Stack](https://github.com/meta/astryx/blob/main/packages/core/src/Stack/Stack.doc.mjs), [Grid](https://github.com/meta/astryx/blob/main/packages/core/src/Grid/Grid.doc.mjs), [GridSpan](https://github.com/meta/astryx/blob/main/packages/core/src/Grid/GridSpan.doc.mjs), [Center](https://github.com/meta/astryx/blob/main/packages/core/src/Center/Center.doc.mjs), [AspectRatio](https://github.com/meta/astryx/blob/main/packages/core/src/AspectRatio/AspectRatio.doc.mjs)
- [Section](https://github.com/meta/astryx/blob/main/packages/core/src/Section/Section.doc.mjs), [Divider](https://github.com/meta/astryx/blob/main/packages/core/src/Divider/Divider.doc.mjs), [ScrollableArea](https://github.com/meta/astryx/blob/main/packages/core/src/ScrollableArea/ScrollableArea.doc.mjs), [Resizable](https://github.com/meta/astryx/blob/main/packages/core/src/Resizable/Resizable.doc.mjs)
- [Layout](https://github.com/meta/astryx/blob/main/packages/core/src/Layout/Layout.doc.mjs), [LayoutHeader](https://github.com/meta/astryx/blob/main/packages/core/src/Layout/LayoutHeader.doc.mjs), [LayoutContent](https://github.com/meta/astryx/blob/main/packages/core/src/Layout/LayoutContent.doc.mjs), [LayoutFooter](https://github.com/meta/astryx/blob/main/packages/core/src/Layout/LayoutFooter.doc.mjs), [LayoutPanel](https://github.com/meta/astryx/blob/main/packages/core/src/Layout/LayoutPanel.doc.mjs)
- [AppShell](https://github.com/meta/astryx/blob/main/packages/core/src/AppShell/AppShell.doc.mjs), [useAppShellMobile](https://github.com/meta/astryx/blob/main/packages/core/src/AppShell/useAppShellMobile.doc.mjs), [TopNav](https://github.com/meta/astryx/blob/main/packages/core/src/TopNav/TopNav.doc.mjs), [SideNav](https://github.com/meta/astryx/blob/main/packages/core/src/SideNav/SideNav.doc.mjs), [MobileNav](https://github.com/meta/astryx/blob/main/packages/core/src/MobileNav/MobileNav.doc.mjs)

템플릿

- [docs/architecture/template-authoring.md](https://github.com/meta/astryx/blob/main/docs/architecture/template-authoring.md)
- [docs/design/template-composition.md](https://github.com/meta/astryx/blob/main/docs/design/template-composition.md)
- 템플릿 저작 가이드: [templates](https://github.com/meta/astryx/blob/main/packages/cli/assets/docs/tree/templates.doc.mjs), [start-a-template](https://github.com/meta/astryx/blob/main/packages/cli/assets/docs/tree/start-a-template.doc.mjs), [template-doc-overview](https://github.com/meta/astryx/blob/main/packages/cli/assets/docs/tree/template-doc-overview.doc.mjs), [page-template](https://github.com/meta/astryx/blob/main/packages/cli/assets/docs/tree/page-template.doc.mjs), [block-template](https://github.com/meta/astryx/blob/main/packages/cli/assets/docs/tree/block-template.doc.mjs), [replace-a-core-template](https://github.com/meta/astryx/blob/main/packages/cli/assets/docs/tree/replace-a-core-template.doc.mjs), [test-template-in-app](https://github.com/meta/astryx/blob/main/packages/cli/assets/docs/tree/test-template-in-app.doc.mjs)
- 품질 기준: [write-good-templates](https://github.com/meta/astryx/blob/main/packages/cli/assets/docs/tree/write-good-templates.doc.mjs), [template-grading-rubric](https://github.com/meta/astryx/blob/main/packages/cli/assets/docs/tree/template-grading-rubric.doc.mjs), [grade-template-with-agent](https://github.com/meta/astryx/blob/main/packages/cli/assets/docs/tree/grade-template-with-agent.doc.mjs), [is-my-code-good](https://github.com/meta/astryx/blob/main/packages/cli/assets/docs/is-my-code-good.doc.mjs)
- CLI: [template 명령 문서](https://github.com/meta/astryx/blob/main/packages/cli/clients/cli/commands/template.doc.mjs), [build 명령 문서](https://github.com/meta/astryx/blob/main/packages/cli/clients/cli/commands/build.doc.mjs), [skeleton 구현](https://github.com/meta/astryx/blob/main/packages/cli/api/template/skeleton/skeleton.mjs), [CLI README](https://github.com/meta/astryx/blob/main/packages/cli/README.md)
- 템플릿 소스: [dashboard](https://github.com/meta/astryx/blob/main/packages/cli/assets/templates/pages/dashboard/page.tsx), [dashboard-alert-rail](https://github.com/meta/astryx/blob/main/packages/cli/assets/templates/pages/dashboard-alert-rail/page.tsx), [incident-console](https://github.com/meta/astryx/blob/main/packages/cli/assets/templates/pages/incident-console/page.tsx), [table-page](https://github.com/meta/astryx/blob/main/packages/cli/assets/templates/pages/table-page/page.tsx), [settings](https://github.com/meta/astryx/blob/main/packages/cli/assets/templates/pages/settings/page.tsx), [shell-side-nav](https://github.com/meta/astryx/blob/main/packages/cli/assets/templates/pages/shell-side-nav/page.tsx)
- 페이지 템플릿 폴더 전체: [packages/cli/assets/templates/pages](https://github.com/meta/astryx/tree/main/packages/cli/assets/templates/pages)
