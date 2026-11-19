
관리 화면에서 로그 1만 건을 한 번에 보여 달라는 요청이 들어옵니다.
페이지네이션은 싫고, 쭉 스크롤하면서 보고 싶다고 합니다.
데이터는 API 한 번으로 금방 옵니다.
그래서 평소처럼 그립니다.

```jsx
<ul>
  {logs.map((log) => (
    <LogRow key={log.id} log={log} />
  ))}
</ul>
```

데이터는 이미 와 있는데 화면이 뜨기까지 한참 걸립니다.
필터를 바꿀 때마다 화면이 멈칫하고, 행 하나를 펼치는 것도 느립니다.
1만 개의 데이터가 문제가 아니라 1만 개의 **DOM**이 문제입니다.

## DOM 노드가 많으면 왜 느릴까

배열 1만 개를 순회하는 건 JavaScript에게 아무 일도 아닙니다.
느린 건 그다음입니다.

행 하나가 아이콘, 시간, 레벨 배지, 메시지로 이루어져 있다면 DOM 노드가 열 개쯤 됩니다.
1만 행이면 10만 개입니다.
이 노드들은 만들어질 때만 비용을 내는 게 아닙니다.

- **생성**: React라면 컴포넌트 1만 개를 렌더하고, 가상 DOM을 비교하고, 실제 노드를 만들어 붙입니다.
- **스타일 계산**: 브라우저는 노드마다 어떤 CSS 규칙이 적용되는지 계산합니다. 상위 요소의 클래스 하나만 바꿔도 아래 노드 전체를 다시 계산해야 할 수 있습니다.
- **레이아웃**: 각 노드의 위치와 크기를 정합니다. 목록 위쪽 행 하나의 높이가 바뀌면 그 아래 모든 행의 위치가 바뀝니다.
- **메모리**: 노드마다 DOM 객체, 스타일 정보, 레이아웃 정보가 붙습니다. React를 쓴다면 컴포넌트마다 파이버도 하나씩 생깁니다.

그런데 화면에 실제로 보이는 행은 많아야 몇십 개입니다.
나머지 9,900여 개는 사용자가 보지도 않는데 비용만 내고 있습니다.
Lighthouse가 DOM 크기가 크다고 경고하는 것도 같은 이유입니다.

## 보이는 것만 그린다

가상 스크롤(virtual scroll, windowing이라고도 합니다)의 아이디어는 단순합니다.
**스크롤 영역 안에 보이는 행만 DOM으로 만들고, 나머지는 빈 공간으로 대신한다.**

스크롤바가 제대로 동작하려면 전체 높이는 1만 행이 다 있을 때와 같아야 합니다.
그래서 구조가 이렇게 됩니다.

- 바깥 상자: 높이가 고정되어 있고 `overflow-y: auto`로 스크롤된다.
- 안쪽 상자: 높이를 전체 높이(행 수 × 행 높이)로 둔다. 스크롤바가 이 높이를 보고 길이를 정한다.
- 실제 행: 지금 보이는 구간만 그리고, 위쪽은 비워 둔 만큼 아래로 밀어 둔다.

행 높이가 48px로 모두 같다면 계산은 나눗셈 한 번입니다.

- 위에서 몇 번째 행부터 보이나: `Math.floor(scrollTop / 48)`
- 몇 번째 행까지 보이나: `Math.ceil((scrollTop + 보이는 높이) / 48)`
- 위쪽 여백: `시작 인덱스 × 48`
- 아래쪽 여백: `(전체 행 수 - 끝 인덱스) × 48`

스크롤할 때마다 이 네 값을 다시 계산하고, 그 구간의 행만 다시 그립니다.
화면 높이가 600px이면 DOM에 있는 행은 열서너 개뿐입니다.
목록이 1만 개든 100만 개든 DOM 크기는 거의 같습니다.

## 직접 만들어 보기

원리를 확인하려고 고정 높이 버전을 직접 만들어 보겠습니다.

```jsx
import { useState } from 'react';

function VirtualList({ items, rowHeight, height, overscan = 5, renderRow }) {
  const [scrollTop, setScrollTop] = useState(0);

  const start = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
  const end = Math.min(items.length, Math.ceil((scrollTop + height) / rowHeight) + overscan);

  return (
    <div
      style={{ height, overflowY: 'auto' }}
      onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
    >
      <div
        style={{
          paddingTop: start * rowHeight,
          paddingBottom: (items.length - end) * rowHeight,
        }}
      >
        {items.slice(start, end).map((item) => (
          <div key={item.id} style={{ height: rowHeight }}>
            {renderRow(item)}
          </div>
        ))}
      </div>
    </div>
  );
}
```

위아래 여백을 `padding`으로 주었습니다.
`paddingTop + 그린 행들의 높이 + paddingBottom`이 항상 `items.length × rowHeight`가 되므로 스크롤바 길이가 변하지 않습니다.
여백 대신 안쪽 상자에 전체 높이를 주고 행 묶음을 `transform: translateY(...)`로 내리는 방식도 많이 씁니다.

`key`로 인덱스가 아니라 `item.id`를 쓴 데도 이유가 있습니다.
가상 스크롤에서는 스크롤할 때마다 보이는 구간이 바뀌어서, 인덱스를 `key`로 쓰면 같은 DOM 노드가 계속 다른 데이터로 재사용됩니다.
행 안에 입력 상태나 펼침 상태가 있다면 엉뚱한 행으로 옮겨 붙습니다.

## overscan: 조금 더 그려 두기

`overscan`은 보이는 구간 위아래로 몇 행을 더 그려 둘지 정하는 값입니다.
위 코드에서는 위아래 5행씩입니다.

정확히 보이는 행만 그리면 빠르게 스크롤할 때 문제가 생깁니다.
브라우저는 스크롤을 먼저 움직이고, 스크롤 이벤트를 받아 React가 새 행을 그리는 건 그 뒤입니다.
그 사이에 비어 있는 여백이 잠깐 드러나서 흰 화면이 번쩍입니다.
몇 행을 미리 그려 두면 이 틈을 메울 수 있습니다.

너무 크게 잡으면 가상 스크롤의 이점이 줄어듭니다.
행이 단순하면 넉넉하게, 행 하나가 무겁다면 작게 잡습니다.

## 높이가 제각각인 행

실무에서 어려운 부분은 여기서부터입니다.
메시지 길이에 따라 줄바꿈이 생기면 행마다 높이가 다릅니다.
그러면 `scrollTop / rowHeight` 같은 나눗셈을 쓸 수 없습니다.

대신 각 행의 시작 위치를 누적해서 기억해 둡니다.
`offsets[i]`가 i번째 행의 시작 위치라면, 스크롤 위치에 해당하는 행은 이진 탐색으로 찾을 수 있습니다.

```js
// offsets는 오름차순. scrollTop 위치에 걸친 행의 인덱스를 찾는다
function findStartIndex(offsets, scrollTop) {
  let lo = 0;
  let hi = offsets.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (offsets[mid] <= scrollTop) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}
```

문제는 **높이를 그려 보기 전에는 모른다**는 것입니다.
그래서 보통 이렇게 합니다.

1. 아직 그리지 않은 행은 예상 높이(예: 48px)로 계산한다.
2. 행을 그리면 실제 높이를 잰다. `ResizeObserver`를 쓰면 이미지 로딩처럼 나중에 높이가 바뀌는 경우도 잡을 수 있다.
3. 잰 높이로 `offsets`를 고치고 전체 높이도 다시 계산한다.

여기서 새로운 문제가 생깁니다.
지금 보는 위치보다 **위쪽** 행의 높이가 예상과 달랐다면, 그 아래 내용이 전부 밀려서 화면이 튑니다.
라이브러리들은 이런 경우 스크롤 위치를 그만큼 보정해서 보고 있던 행이 제자리에 있도록 맞춰 줍니다.
예상 높이를 실제 평균에 가깝게 잡을수록 스크롤바가 덜 출렁입니다.

이 정도 되면 직접 만들기보다 라이브러리를 쓰는 편이 현실적입니다.

## 라이브러리: TanStack Virtual

React에서는 TanStack Virtual, react-window, react-virtuoso가 많이 쓰입니다.
TanStack Virtual은 마크업을 강제하지 않고 계산만 해 주는 헤드리스 방식입니다.

```jsx
import { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';

function LogList({ logs }) {
  const parentRef = useRef(null);

  const virtualizer = useVirtualizer({
    count: logs.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 48, // 예상 높이
    overscan: 5,
  });

  return (
    <div ref={parentRef} style={{ height: 600, overflowY: 'auto' }}>
      <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
        {virtualizer.getVirtualItems().map((row) => (
          <div
            key={row.key}
            data-index={row.index}
            ref={virtualizer.measureElement} // 실제 높이를 잰다
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${row.start}px)`,
            }}
          >
            <LogRow log={logs[row.index]} />
          </div>
        ))}
      </div>
    </div>
  );
}
```

`getVirtualItems()`는 지금 그려야 할 행의 인덱스와 시작 위치(`start`)를, `getTotalSize()`는 전체 높이를 돌려줍니다.
`measureElement`를 `ref`로 붙이고 `data-index`를 달아 두면 실제 높이를 재서 위치를 고쳐 줍니다.
앞에서 직접 구현한 것과 같은 구조라서, 원리를 알고 나면 API가 낯설지 않습니다.
특정 행으로 이동하는 `scrollToIndex`, 가로 방향 목록, 격자도 지원합니다.

## 가상 스크롤의 대가

가상 스크롤에서는 화면 밖의 행이 DOM에 없습니다.
그래서 생기는 문제가 몇 가지 있습니다.

**Ctrl+F 검색이 안 됩니다.**
브라우저의 페이지 내 검색은 DOM에 있는 텍스트만 찾습니다.
화면 밖의 9,900행은 DOM에 없으니 찾을 수 없습니다.
로그 화면처럼 검색이 중요한 곳이라면 목록 위에 직접 검색 기능을 만들어야 합니다.

**스크린 리더가 전체를 모릅니다.**
보조 기술은 DOM을 읽으니, 목록에 항목이 열몇 개뿐이라고 알립니다.
목록이라면 각 항목에 `aria-setsize`(전체 개수)와 `aria-posinset`(몇 번째인지)을, 표라면 `aria-rowcount`와 `aria-rowindex`를 달아서 실제 규모를 알려 줄 수 있습니다.
포커스도 조심해야 합니다. 키보드로 포커스한 행이 스크롤 밖으로 나가 언마운트되면 포커스가 사라집니다.

**스크롤 위치 복원이 어렵습니다.**
상세 페이지에 갔다가 뒤로 오면 브라우저는 예전 스크롤 위치로 돌려놓으려 하지만, 그 시점에 목록이 아직 그려지지 않았거나 높이 추정이 달라서 엉뚱한 곳에 떨어지기 쉽습니다.
보통은 떠날 때 스크롤 위치나 첫 번째로 보이던 행의 인덱스를 저장해 두었다가, 돌아왔을 때 직접 복원합니다.
TanStack Virtual에는 이럴 때 쓰는 `initialOffset` 옵션이 있습니다.

이 밖에도 인쇄하면 보이는 부분만 나오고, 전체 높이가 아주 크면 브라우저마다 다른 요소 높이 상한에 걸릴 수 있습니다.
행이 수백만 개라면 그 점도 확인해야 합니다.

## 대안: content-visibility: auto

DOM은 그대로 두고 **렌더링만 건너뛰는** 방법도 있습니다.
CSS의 `content-visibility: auto`입니다.

```css
.log-row {
  content-visibility: auto;
  contain-intrinsic-size: auto 48px;
}
```

이 속성이 붙은 요소가 화면 밖에 있으면, 브라우저는 그 안쪽의 스타일 계산, 레이아웃, 페인트를 건너뜁니다.
화면에 가까워지면 그때 그립니다.
가상 스크롤이 JavaScript로 하던 일을 브라우저가 렌더링 단계에서 해 줍니다.

`contain-intrinsic-size`는 건너뛴 요소가 차지할 자리입니다.
렌더링을 건너뛴 요소는 내용을 모르니 높이가 0이 되는데, 그러면 스크롤바가 엉망이 됩니다.
그래서 예상 크기를 알려 주고, 앞에 `auto`를 붙이면 한 번 그려진 뒤로는 마지막으로 잰 실제 크기를 기억해서 씁니다.

장점은 가상 스크롤의 단점과 정확히 반대입니다.
DOM이 그대로 있으니 Ctrl+F로 찾을 수 있고, 보조 기술도 내용을 읽을 수 있고, 스크롤 복원도 브라우저 기본 동작대로 됩니다.
코드도 CSS 두 줄입니다.

대신 줄여 주는 것은 렌더링 비용뿐입니다.
DOM 노드 1만 개를 만드는 비용, 메모리, React가 컴포넌트 1만 개를 렌더하는 비용은 그대로입니다.
그래서 이렇게 나눠 생각하면 됩니다.

- 긴 글, 섹션이 많은 문서, 수백 개 정도의 카드처럼 **DOM은 감당할 만한데 렌더링이 무거운** 곳에는 `content-visibility`.
- 수만 행의 로그, 표처럼 **DOM 자체가 너무 많은** 곳에는 가상 스크롤.

`content-visibility`는 작성 시점 기준 Chrome, Firefox, Safari 최신 버전이 모두 지원합니다. 지원 범위는 MDN에서 확인하세요.

마지막으로, 1만 행을 정말 한 번에 보여 줘야 하는지도 물어볼 만합니다.
사람이 1만 행을 스크롤하며 읽는 일은 드뭅니다.
좋은 필터와 검색, 서버 쪽 페이지네이션이 가상 스크롤보다 나은 답일 때도 많습니다.

## 정리

- 목록이 느린 이유는 데이터 개수가 아니라 DOM 노드 개수입니다. 노드마다 생성, 스타일 계산, 레이아웃, 메모리 비용이 듭니다.
- 가상 스크롤은 보이는 행만 그리고 나머지는 여백으로 채웁니다. 고정 높이라면 `scrollTop / 행 높이`로 시작 인덱스를 구하고, 위아래 여백으로 전체 높이를 유지합니다.
- `overscan`으로 위아래 몇 행을 더 그려 두면 빠른 스크롤에서 빈 화면이 덜 보입니다.
- 높이가 제각각이면 예상 높이로 시작해서 그린 뒤 재고, 누적 위치를 고칩니다. 이 단계부터는 TanStack Virtual 같은 라이브러리가 현실적입니다.
- 가상 스크롤은 Ctrl+F, 스크린 리더, 스크롤 복원에서 대가를 치릅니다. 직접 검색, ARIA 속성, 위치 저장으로 보완합니다.
- DOM 수가 감당할 만하다면 `content-visibility: auto`가 더 단순한 대안입니다.

## 참고

- [TanStack Virtual 공식 문서](https://tanstack.com/virtual/latest)
- [MDN - content-visibility](https://developer.mozilla.org/en-US/docs/Web/CSS/content-visibility)
- [MDN - contain-intrinsic-size](https://developer.mozilla.org/en-US/docs/Web/CSS/contain-intrinsic-size)
- [web.dev - content-visibility: the new CSS property that boosts your rendering performance](https://web.dev/articles/content-visibility)
- [Chrome for Developers - Avoid an excessive DOM size](https://developer.chrome.com/docs/lighthouse/performance/dom-size)
- [MDN - aria-setsize](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Attributes/aria-setsize)
