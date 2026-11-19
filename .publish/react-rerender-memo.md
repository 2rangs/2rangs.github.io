
React DevTools에서 "Highlight updates when components render"를 켜 봤습니다.
검색창에 한 글자 칠 때마다 화면 전체가 번쩍입니다.
사이드바도, 헤더도, 상관없는 차트도 테두리가 깜빡입니다.

여기서 많은 사람이 하는 일은 비슷합니다.
번쩍이는 컴포넌트마다 `memo`를 감싸고, 넘기는 함수마다 `useCallback`을 붙입니다.
그런데 한참 붙이고 나서 다시 보면 여전히 번쩍이는 컴포넌트가 남아 있고, 코드는 훨씬 읽기 어려워져 있습니다.

`memo`가 언제 효과가 있고 언제 없는지 알려면, 먼저 React가 언제 컴포넌트를 다시 렌더링하는지부터 정확히 알아야 합니다.

## 리렌더가 일어나는 세 가지 경우

컴포넌트가 다시 렌더링되는 이유는 세 가지뿐입니다.

1. **자기 state가 바뀌었을 때.** `useState`의 setter나 `useReducer`의 dispatch가 불렸고, 새 값이 이전 값과 다를 때입니다.
2. **부모가 렌더링됐을 때.** 부모 함수가 다시 실행되면 그 안에서 반환한 자식들도 기본적으로 다시 렌더링됩니다.
3. **구독하는 context의 값이 바뀌었을 때.** `useContext`로 읽는 Provider의 `value`가 바뀌면 그 컴포넌트가 다시 렌더링됩니다.

여기서 흔한 오해가 하나 있습니다.
"props가 바뀌면 리렌더된다"는 말입니다.
틀린 말은 아니지만 순서가 거꾸로입니다.
props가 바뀌는 건 부모가 렌더링됐기 때문이고, React는 기본적으로 **props가 바뀌었는지 보지 않고** 부모가 렌더링되면 자식도 렌더링합니다.
props가 똑같아도 마찬가지입니다.

```jsx
function Page() {
  const [keyword, setKeyword] = useState('');
  return (
    <>
      <input value={keyword} onChange={(e) => setKeyword(e.target.value)} />
      <Sidebar />   {/* props가 하나도 없지만 매 입력마다 렌더링된다 */}
      <SalesChart />
    </>
  );
}
```

`Sidebar`는 props가 없습니다.
그래도 `Page`가 렌더링될 때마다 같이 렌더링됩니다.
처음에 본 "화면 전체가 번쩍이는" 현상의 원인이 이것입니다.

### 같은 값으로 setState하면

setter에 이전과 같은 값을 넘기면 React는 리렌더를 건너뜁니다.
비교는 `Object.is`로 합니다.
그래서 숫자나 문자열은 같은 값이면 건너뛰지만, 객체나 배열은 내용이 같아도 새로 만들었다면 다른 값입니다.

```js
setFilter({ ...filter }); // 내용은 같아도 새 객체라 리렌더된다
```

참고로 React 문서는 같은 값을 넘겨도 "자식으로 내려가기 전에 그 컴포넌트를 한 번 더 호출할 수는 있다"고 적어 두고 있습니다.
이 경우에도 결과는 버려지고 자식까지 내려가지 않으니 걱정할 일은 아닙니다.

## 렌더링은 DOM을 바꾸는 일이 아닙니다

"리렌더가 많다"는 말에 겁먹기 전에 짚을 점이 있습니다.
React에서 렌더링은 **컴포넌트 함수를 호출해서 새 JSX를 얻는 것**까지입니다.

그다음 React는 이전 결과와 새 결과를 비교하고(재조정), 실제로 달라진 부분만 DOM에 반영합니다(커밋).
`Sidebar`가 다시 렌더링돼도 반환한 JSX가 이전과 같다면 DOM은 전혀 건드리지 않습니다.

그래서 DevTools에서 번쩍이는 것 자체는 문제가 아닙니다.
대부분의 컴포넌트 함수는 수십 마이크로초 안에 끝납니다.
문제가 되는 건 다음과 같은 경우입니다.

- 렌더링 안에서 무거운 계산을 한다(수천 개 항목 정렬·필터링, 큰 데이터 변환).
- 렌더링되는 컴포넌트 수가 아주 많다(긴 목록의 각 행, 큰 표의 각 셀).
- 그 결과 입력이 눈에 띄게 끊긴다.

리렌더를 0으로 만드는 게 목표가 아니라, **느려서 사용자가 느끼는 지점**을 없애는 게 목표입니다.

## memo가 하는 일, 그리고 비용

`memo`로 감싼 컴포넌트는 부모가 렌더링돼도 **props가 이전과 같으면** 렌더링을 건너뜁니다.
비교는 각 prop을 `Object.is`로 하나씩 보는 얕은 비교입니다.

```jsx
const SalesChart = memo(function SalesChart({ data, onSelect }) {
  // 무거운 차트 렌더링
});
```

문제는 이 비교가 참조를 본다는 점입니다.
부모에서 이렇게 넘기면 `memo`는 아무 일도 하지 않습니다.

```jsx
function Page() {
  const [keyword, setKeyword] = useState('');
  const data = rows.filter((row) => row.visible); // 매번 새 배열
  return (
    <SalesChart
      data={data}
      onSelect={(id) => console.log(id)} // 매번 새 함수
      options={{ stacked: true }}         // 매번 새 객체
    />
  );
}
```

렌더링마다 새 배열, 새 함수, 새 객체가 만들어지니 얕은 비교는 매번 "다르다"고 답합니다.
비교 비용만 늘고 렌더링은 그대로 일어납니다.

그래서 `useMemo`와 `useCallback`이 등장합니다.

```jsx
const data = useMemo(() => rows.filter((row) => row.visible), [rows]);
const handleSelect = useCallback((id) => console.log(id), []);
const options = useMemo(() => ({ stacked: true }), []);
```

이렇게 하면 `rows`가 바뀌지 않는 한 같은 참조가 유지되고, 그제야 `memo`가 동작합니다.
`options`처럼 바뀌지 않는 값은 아예 컴포넌트 밖으로 빼는 편이 더 간단합니다.

즉 **`memo`는 혼자서는 거의 쓸모가 없습니다**.
부모가 넘기는 모든 객체와 함수의 참조가 안정적이어야 효과가 납니다.
prop 하나만 매번 새로 만들어져도 효과가 사라집니다.
나중에 누군가 prop 하나를 추가하는 순간 이 조건이 깨질 수 있고, 에러도 경고도 나지 않습니다.

아무 데나 `memo`를 붙이면 안 되는 이유를 정리하면 이렇습니다.

- 효과를 보려면 부모 쪽 코드까지 함께 관리해야 한다.
- 효과가 없을 때도 비교 비용과 메모리 비용은 든다.
- `useMemo`, `useCallback`의 의존성 배열이 늘어나면서 오래된 값을 참조하는 버그가 생길 여지가 커진다.
- 무엇보다 코드가 읽기 어려워진다.

물론 `memo`가 정말 필요한 곳도 있습니다.
렌더링이 확실히 무겁고, props가 자주 바뀌지 않으며, 부모가 자주 렌더링되는 컴포넌트입니다.
이 조건은 감이 아니라 측정으로 확인해야 합니다. 측정 방법은 뒤에서 다룹니다.

## memo보다 먼저 해 볼 것: 구조 바꾸기

React 문서도 `memo`를 쓰기 전에 몇 가지 구조적인 방법을 먼저 권합니다.
이 방법들은 비교 자체가 필요 없게 만들기 때문에 더 확실합니다.

### 상태를 쓰는 곳으로 끌어내리기

앞의 예에서 `keyword`는 검색창에서만 씁니다.
그런데 `Page`가 들고 있으니 `Page` 아래 전체가 매 입력마다 렌더링됩니다.
상태를 실제로 쓰는 컴포넌트로 내려 보냅니다.

```jsx
function Page() {
  return (
    <>
      <SearchBox />  {/* keyword 상태는 이 안으로 */}
      <Sidebar />
      <SalesChart />
    </>
  );
}

function SearchBox() {
  const [keyword, setKeyword] = useState('');
  return <input value={keyword} onChange={(e) => setKeyword(e.target.value)} />;
}
```

이제 입력할 때 렌더링되는 건 `SearchBox`뿐입니다.
`memo`를 하나도 쓰지 않았습니다.

상태는 "필요할지도 모르니 위에 두자"는 이유로 끌어올려지는 경우가 많습니다.
정말 여러 컴포넌트가 공유해야 하는지 한 번 의심해 보면, 생각보다 많은 상태가 아래로 내려갈 수 있습니다.

### 바뀌지 않는 부분을 children으로 넘기기

상태를 내릴 수 없는 경우도 있습니다.
예를 들어 스크롤 위치에 따라 바깥 래퍼의 스타일이 바뀌는데, 그 안에 무거운 콘텐츠가 있는 경우입니다.

```jsx
function ScrollShadow({ children }) {
  const [scrolled, setScrolled] = useState(false);
  return (
    <div
      className={scrolled ? 'shadow' : ''}
      onScroll={(e) => setScrolled(e.currentTarget.scrollTop > 0)}
    >
      {children}
    </div>
  );
}

function Page() {
  return (
    <ScrollShadow>
      <HeavyTable />
    </ScrollShadow>
  );
}
```

`scrolled`가 바뀌면 `ScrollShadow`는 다시 렌더링됩니다.
하지만 `HeavyTable`은 다시 렌더링되지 않습니다.

이유는 `<HeavyTable />`이라는 JSX를 **누가 만들었는가**에 있습니다.
이 요소는 `Page`가 렌더링될 때 만들어져 `children`으로 전달됐습니다.
`ScrollShadow`가 다시 렌더링돼도 `Page`는 렌더링되지 않았으니 `children`은 이전과 완전히 같은 객체입니다.
React는 같은 요소 객체를 만나면 그 아래로 내려가지 않습니다.

`memo`가 props를 비교해서 얻는 효과를 비교 없이 구조만으로 얻었습니다.
레이아웃, 모달, 애니메이션 래퍼처럼 "상태를 가진 껍데기 + 무거운 내용물" 모양이면 거의 항상 쓸 수 있는 방법입니다.

### context는 쪼개서

context 값이 바뀌면 그 context를 읽는 모든 컴포넌트가 다시 렌더링됩니다.
이건 `memo`로 막을 수 없습니다. `memo`는 부모로부터의 렌더링만 막고, context 구독에 의한 렌더링은 막지 않습니다.

흔한 실수는 Provider의 `value`에 매번 새 객체를 넣는 것입니다.

```jsx
function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  // AuthProvider가 렌더링될 때마다 새 객체 → 모든 구독자 리렌더
  return <AuthContext.Provider value={{ user, setUser }}>{children}</AuthContext.Provider>;
}
```

`value`를 `useMemo`로 감싸 `user`가 바뀔 때만 새 객체가 되게 하거나, 자주 바뀌는 값과 거의 안 바뀌는 값을 서로 다른 context로 나눕니다.
테마와 현재 마우스 좌표를 한 context에 넣으면, 마우스가 움직일 때마다 테마만 읽는 버튼까지 전부 렌더링됩니다.

## React Compiler는 무엇을 해 주나

이 모든 일을 사람이 직접 하기 번거롭다는 데서 나온 것이 React Compiler입니다.
빌드 시점에 컴포넌트와 훅 코드를 분석해서, 값과 JSX가 실제로 의존하는 것이 바뀌지 않았을 때 이전 결과를 재사용하도록 코드를 바꿔 줍니다.
2025년 10월에 1.0 정식 버전이 나왔고, Babel 플러그인 형태로 Vite, Next.js 등에서 쓸 수 있습니다.

알아 둘 점이 몇 가지 있습니다.

- **자동 메모이제이션입니다.** 컴파일러가 하는 일은 사람이 `memo`, `useMemo`, `useCallback`으로 하던 것과 같은 종류이고, 대개 더 세밀하게 합니다. 렌더링 모델 자체가 바뀌는 것은 아닙니다. state가 바뀌면 그 컴포넌트는 여전히 렌더링됩니다.
- **React의 규칙을 지킨 코드여야 합니다.** 렌더링 중에 props나 state를 직접 바꾸거나, 렌더링 중에 ref를 읽는 등 규칙을 어긴 코드는 컴파일러가 최적화하지 않고 건너뜁니다. 그래서 컴파일러와 함께 제공되는 ESLint 규칙을 먼저 켜 두는 것을 권장합니다.
- **기존 `useMemo`, `useCallback`을 지울 필요는 없습니다.** 공식 문서는 새 코드에서는 컴파일러에 맡기되, 기존 코드는 충분히 테스트한 뒤 정리하라는 입장입니다. effect의 의존성으로 쓰이는 값처럼 참조가 정확히 유지돼야 하는 곳에서는 여전히 직접 쓰는 게 의도를 분명히 하는 방법입니다.

컴파일러가 있다고 해서 앞에서 말한 구조 문제가 사라지지는 않습니다.
상태가 너무 위에 있으면 컴파일러가 아래 컴포넌트의 렌더링 결과를 재사용하더라도 상위 컴포넌트는 매번 실행되고, context 설계가 나쁘면 구독자는 여전히 다시 렌더링됩니다.
컴파일러는 좋은 구조 위에서 남은 비용을 줄여 주는 도구에 가깝습니다.

## 감 대신 Profiler로

"이 컴포넌트가 느린 것 같다"는 감은 자주 틀립니다.
React DevTools의 Profiler 탭에서 녹화 버튼을 누르고, 느리다고 느낀 동작을 한 번 한 뒤 멈춥니다.

- **Flamegraph**에서 커밋마다 어떤 컴포넌트가 몇 ms 걸렸는지 볼 수 있습니다. 회색은 이번 커밋에서 렌더링되지 않은 컴포넌트입니다.
- 설정의 "Record why each component rendered while profiling"을 켜면 컴포넌트를 눌렀을 때 왜 렌더링됐는지(어떤 props, state, hook이 바뀌었는지) 보여 줍니다.
- 개발 빌드는 프로덕션보다 느립니다. 절대 수치보다는 상대적인 비율을 보고, 정말 중요한 측정은 프로파일링용 프로덕션 빌드로 합니다.

코드 안에서 측정하고 싶다면 `<Profiler>` 컴포넌트를 쓸 수 있습니다.

```jsx
import { Profiler } from 'react';

function onRender(id, phase, actualDuration) {
  if (actualDuration > 16) {
    console.warn(`${id} ${phase}: ${actualDuration.toFixed(1)}ms`);
  }
}

<Profiler id="SalesChart" onRender={onRender}>
  <SalesChart data={data} />
</Profiler>
```

`actualDuration`은 이번 커밋에서 그 트리를 렌더링하는 데 걸린 시간입니다.
측정해서 실제로 오래 걸리는 곳을 찾고, 구조를 먼저 고치고, 그래도 남으면 그때 `memo`를 씁니다.
`memo`를 붙인 뒤에는 다시 측정해서 정말 렌더링이 건너뛰어졌는지 확인합니다.
참조가 하나라도 새로 만들어지고 있다면 Profiler가 바로 알려 줍니다.

## 정리

- 컴포넌트는 자기 state가 바뀔 때, 부모가 렌더링될 때, 구독하는 context가 바뀔 때 다시 렌더링됩니다. props가 같아도 부모가 렌더링되면 자식도 렌더링되는 게 기본입니다.
- 렌더링은 함수를 호출하는 것이고, DOM은 달라진 부분만 바뀝니다. 리렌더 횟수가 아니라 사용자가 느끼는 느림을 문제로 삼아야 합니다.
- `memo`는 props를 참조로 비교합니다. 부모가 넘기는 객체와 함수가 매번 새로 만들어지면 효과가 없고, 비용만 남습니다.
- `memo`보다 먼저 상태를 끌어내리고, 바뀌지 않는 부분을 `children`으로 넘기고, context를 쪼개 보세요. 비교 없이 렌더링 자체를 없앨 수 있습니다.
- React Compiler는 메모이제이션을 자동으로 해 주지만, React 규칙을 지킨 코드가 전제이고 구조 문제까지 고쳐 주지는 않습니다.
- 감이 아니라 Profiler로 측정하고, 고친 뒤에도 다시 측정합니다.

## 참고

- [React - memo](https://react.dev/reference/react/memo)
- [React - useMemo](https://react.dev/reference/react/useMemo)
- [React - useCallback](https://react.dev/reference/react/useCallback)
- [React - Render and Commit](https://react.dev/learn/render-and-commit)
- [React - Profiler](https://react.dev/reference/react/Profiler)
- [React Compiler 소개](https://react.dev/learn/react-compiler)
- [Dan Abramov - Before You memo()](https://overreacted.io/before-you-memo/)
