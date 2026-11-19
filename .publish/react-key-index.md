
할 일 목록이 있습니다.
각 줄에는 할 일 이름과, 메모를 적는 작은 입력창이 있습니다.
첫 번째 줄 "장보기"의 메모 칸에 "우유, 계란"이라고 적고 "장보기"를 삭제했습니다.

그런데 "우유, 계란"이 사라지지 않습니다.
이제 첫 줄이 된 "운동하기"의 메모 칸에 그대로 남아 있습니다.

코드를 열어 보면 대개 이 한 줄이 보입니다.

```jsx
{todos.map((todo, index) => <TodoRow key={index} todo={todo} />)}
```

콘솔에 key 경고가 떠서 `index`를 넣었더니 경고가 사라졌고, 그 뒤로 잊고 있던 코드입니다.
경고는 사라졌지만 문제는 그대로였습니다.

## key는 "이게 같은 컴포넌트인가"를 알려 주는 이름표입니다

상태가 바뀌면 React는 새 JSX를 만들고, 이전 결과와 비교해서 바뀐 부분만 반영합니다.
이 비교를 재조정(reconciliation)이라고 합니다.

리스트를 비교할 때 React가 답해야 하는 질문은 이것입니다.
"이전 목록의 이 항목이 새 목록의 어느 항목과 같은 것인가?"
같은 것이라면 컴포넌트와 그 상태, DOM을 그대로 두고 props만 바꿉니다.
없어졌다면 언마운트하고, 새로 생겼다면 마운트합니다.

key가 없으면 React는 위치로 판단합니다. 첫 번째는 첫 번째와, 두 번째는 두 번째와 같은 것으로 봅니다.
key가 있으면 위치 대신 key로 짝을 짓습니다.
그래서 key는 "이 항목은 어떤 데이터인가"를 나타내는 안정적인 값이어야 합니다.

핵심은 **React가 컴포넌트의 상태를 key에 묶어 둔다**는 것입니다.
`useState`로 만든 상태, uncontrolled input에 들어 있는 DOM 값, 포커스, 스크롤 위치 같은 것들은 전부 "key가 1인 그 컴포넌트"에 속합니다.
데이터가 어떻게 움직였는지는 React가 모릅니다. React는 key만 봅니다.

## index key로 재현해 보기

직접 재현해 보면 바로 이해됩니다.

```jsx
function TodoRow({ todo, onDelete }) {
  return (
    <li>
      <span>{todo.title}</span>
      <input placeholder="메모" />  {/* uncontrolled: 값은 DOM에 있다 */}
      <button onClick={() => onDelete(todo.id)}>삭제</button>
    </li>
  );
}

function TodoList() {
  const [todos, setTodos] = useState([
    { id: 'a', title: '장보기' },
    { id: 'b', title: '운동하기' },
    { id: 'c', title: '책 읽기' },
  ]);

  const handleDelete = (id) => setTodos((prev) => prev.filter((t) => t.id !== id));

  return (
    <ul>
      {todos.map((todo, index) => (
        <TodoRow key={index} todo={todo} onDelete={handleDelete} />
      ))}
    </ul>
  );
}
```

첫 줄 메모에 "우유, 계란"을 적고 "장보기"를 지우면 이렇게 됩니다.

| key | 삭제 전 | 삭제 후 |
| --- | --- | --- |
| 0 | 장보기 / 메모: 우유, 계란 | 운동하기 / 메모: **우유, 계란** |
| 1 | 운동하기 / 메모: (빈칸) | 책 읽기 / 메모: (빈칸) |
| 2 | 책 읽기 / 메모: (빈칸) | (언마운트) |

React 입장에서 보면 일어난 일은 "key 0과 1의 props가 바뀌었고, key 2가 사라졌다"입니다.
실제로 지운 건 첫 번째 항목인데, React는 **마지막 컴포넌트를 지우고** 앞의 두 개에 새 props를 넣었습니다.
제목은 props로 그리니 올바르게 바뀌지만, 메모는 key 0 컴포넌트의 DOM에 남아 있으니 그대로입니다.

정렬도 마찬가지입니다.
목록을 이름순으로 다시 정렬하면 제목은 정렬된 순서로 보이는데 메모는 원래 위치에 남습니다.
맨 앞에 새 항목을 추가하면 모든 메모가 한 줄씩 아래 항목에 붙습니다.

key를 `todo.id`로 바꾸면 해결됩니다.
"장보기"를 지우면 key `'a'`인 컴포넌트가 언마운트되고, `'b'`와 `'c'`는 자기 상태를 그대로 들고 올라옵니다.

### controlled input이면 괜찮을까

"메모를 state로 관리하면(controlled) 값이 데이터에 붙어 있으니 괜찮지 않나"라고 생각할 수 있습니다.
값 자체는 맞게 보입니다. 메모가 `todo.memo`에 있다면 props를 따라가니까요.

하지만 key에 묶이는 건 input 값만이 아닙니다.

- 컴포넌트 안의 `useState`(펼침 여부, 편집 모드, 유효성 에러 표시 등)
- 포커스와 커서 위치
- `useEffect`에서 시작한 작업, 애니메이션 상태
- 자식 컴포넌트의 상태 전부

"편집 중" 상태가 컴포넌트 안에 있다면, 정렬 후에 엉뚱한 줄이 편집 모드로 보입니다.
포커스가 있던 입력창에 계속 타이핑하는데 갑자기 다른 항목이 수정되는 일도 생깁니다.
컴포넌트에 상태가 하나라도 있다면 index key는 언제든 문제가 될 수 있습니다.

### 성능 문제도 있습니다

맨 앞에 항목을 하나 추가하는 경우를 생각해 보세요.
id key라면 React는 새 항목 하나만 마운트하고 나머지는 그대로 둡니다.
index key라면 모든 key의 내용이 한 칸씩 밀리므로 모든 항목의 props가 바뀌고, 마지막에 하나가 새로 마운트됩니다.
`memo`로 감싼 행이라도 props가 실제로 바뀌었으니 전부 다시 렌더링됩니다.
긴 목록이라면 체감될 정도의 차이가 납니다.

## index를 써도 되는 경우

그렇다고 index key가 항상 틀린 것은 아닙니다.
다음 조건이 모두 맞으면 index를 써도 문제가 생기지 않습니다.

- 목록이 정적이다. 항목이 추가·삭제·재정렬·필터링되지 않는다.
- 항목 컴포넌트에 상태가 없고, uncontrolled input도 없다.
- 데이터에 고유한 id가 없다.

예를 들어 서버에서 받아 그대로 보여 주기만 하는 공지 문구 목록이나, 고정된 메뉴처럼 순서가 절대 바뀌지 않는 목록은 index로 충분합니다.
반대로 "지금은 안 바뀌지만 나중에 정렬 기능이 들어갈 수도 있는" 목록이라면 처음부터 id를 쓰는 편이 안전합니다.
key 문제는 버그가 생겨도 에러가 나지 않아서, 기능이 추가된 뒤 한참 지나서야 발견되기 때문입니다.

데이터에 id가 없다면 **데이터를 만들 때** id를 붙여 주면 됩니다.
이 "언제 만드느냐"가 다음 이야기입니다.

## crypto.randomUUID()를 key에 바로 쓰면 안 되는 이유

id가 없을 때 이런 코드를 쓰는 경우가 있습니다.

```jsx
{items.map((item) => <Row key={crypto.randomUUID()} item={item} />)}
```

고유하니까 경고도 안 나고 index 문제도 없어 보입니다.
하지만 index보다 나쁜 방법입니다.

렌더링될 때마다 모든 key가 새 값이 됩니다.
React는 이전 key와 일치하는 것이 하나도 없다고 판단해서, **렌더링될 때마다 모든 행을 언마운트하고 새로 마운트합니다.**

- 입력창에 한 글자 칠 때마다 행이 새로 만들어져 포커스가 날아갑니다.
- 행 안의 모든 상태가 매번 초기화됩니다.
- DOM을 매번 지우고 다시 만드니 index key보다 훨씬 느립니다.
- 행 안의 effect가 매번 정리되고 다시 실행됩니다.

`Math.random()`이나 `Date.now()`도 같은 문제를 일으킵니다.
key는 **같은 데이터라면 렌더링이 몇 번 일어나도 같은 값**이어야 합니다.

id는 렌더링할 때가 아니라 데이터가 생기는 시점에 만들어야 합니다.

```jsx
function addItem(text) {
  setItems((prev) => [...prev, { id: crypto.randomUUID(), text }]);
}

// 서버 응답에 id가 없다면 받는 시점에 한 번만 붙인다
const withIds = response.map((row) => ({ ...row, id: crypto.randomUUID() }));
```

이렇게 만든 id는 state에 저장되므로 렌더링이 반복돼도 변하지 않습니다.
참고로 `crypto.randomUUID()`는 보안 컨텍스트(HTTPS나 localhost)에서만 쓸 수 있습니다. 사내망에서 HTTP로 띄운 개발 서버에서는 `undefined`일 수 있으니 주의하세요.

`useId` 훅을 떠올릴 수도 있지만, 이 훅은 접근성 속성(`htmlFor`, `aria-describedby`)에 쓸 고유 id를 만드는 용도입니다.
React 문서에서도 리스트의 key 생성에는 쓰지 말라고 명시하고 있습니다.

## key로 상태를 일부러 초기화하기

key의 원리를 알면 반대로 이용할 수도 있습니다.
"key가 바뀌면 React는 다른 컴포넌트로 보고 새로 마운트한다"는 성질입니다.
리스트가 아닌 곳에서도 key를 쓸 수 있습니다.

사용자 프로필 편집 화면을 예로 들어 보겠습니다.
왼쪽 목록에서 사용자를 고르면 오른쪽에 편집 폼이 나옵니다.

```jsx
function EditProfile({ user }) {
  const [name, setName] = useState(user.name); // 초깃값은 처음 마운트될 때만 쓰인다
  return <input value={name} onChange={(e) => setName(e.target.value)} />;
}

<EditProfile user={selectedUser} />
```

A를 고른 뒤 B를 고르면 폼에는 여전히 A의 이름이 남아 있습니다.
`useState`의 초깃값은 처음 마운트될 때만 쓰이고, 같은 위치의 같은 컴포넌트는 props가 바뀌어도 상태를 유지하기 때문입니다.

이걸 `useEffect`로 고치려는 경우가 많습니다.

```jsx
useEffect(() => {
  setName(user.name);
}, [user.id]);
```

동작은 하지만, 한 번은 이전 이름으로 그려진 뒤 다시 그려지고, 상태가 여러 개라면 하나하나 다 초기화해야 합니다.
key를 쓰면 한 줄로 끝납니다.

```jsx
<EditProfile key={selectedUser.id} user={selectedUser} />
```

사용자가 바뀌면 key가 바뀌고, React는 이전 `EditProfile`을 통째로 버리고 새로 만듭니다.
그 안의 모든 상태와 자식의 상태까지 깨끗하게 초기화됩니다.
React 문서의 "You Might Not Need an Effect"에서도 이 방법을 권합니다.

다만 새로 마운트하는 것이니 비용이 있습니다.
폼처럼 가벼운 컴포넌트에는 좋지만, 무거운 차트나 지도처럼 마운트 비용이 큰 컴포넌트에 자주 바뀌는 key를 주면 매번 처음부터 다시 그리게 됩니다.

## 그 밖에 알아 둘 것

- **key는 형제 사이에서만 고유하면 됩니다.** 서로 다른 목록에서 같은 key를 써도 괜찮습니다.
- **key는 props로 전달되지 않습니다.** 자식에서 `props.key`는 `undefined`입니다. 자식이 id를 알아야 하면 `id={item.id}`처럼 따로 넘깁니다.
- **Fragment에 key를 줄 때는 `<Fragment key={...}>`를 씁니다.** 축약형 `<>...</>`에는 key를 줄 수 없습니다.
- **key는 map 안의 가장 바깥 요소에 줍니다.** `Row` 안의 `<li>`에 key를 줘도 리스트 재조정에는 아무 효과가 없습니다.

## 정리

- key는 React가 이전 항목과 새 항목을 짝짓는 이름표입니다. 컴포넌트의 상태, DOM 값, 포커스는 전부 key에 묶입니다.
- index key는 삭제·삽입·정렬이 일어나면 이름표가 다른 데이터에 붙어서, 입력값이나 상태가 엉뚱한 줄에 남습니다. 에러도 나지 않습니다.
- 정적인 목록이고 항목에 상태가 없다면 index도 괜찮습니다. 바뀔 가능성이 조금이라도 있으면 id를 씁니다.
- `crypto.randomUUID()`를 렌더링 중에 key로 만들면 매번 전부 새로 마운트됩니다. id는 데이터가 생길 때 한 번만 만듭니다.
- key를 바꾸면 컴포넌트가 새로 마운트된다는 성질로, effect 없이 상태를 깔끔하게 초기화할 수 있습니다.

## 참고

- [React - Rendering Lists: Keeping list items in order with key](https://react.dev/learn/rendering-lists#keeping-list-items-in-order-with-key)
- [React - Preserving and Resetting State](https://react.dev/learn/preserving-and-resetting-state)
- [React - You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect)
- [React - useId](https://react.dev/reference/react/useId)
- [MDN - Crypto: randomUUID()](https://developer.mozilla.org/en-US/docs/Web/API/Crypto/randomUUID)
