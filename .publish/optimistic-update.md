
SNS에서 하트를 누르면 바로 빨갛게 바뀝니다.
지하철에서 신호가 약할 때 눌러도 똑같이 바로 바뀝니다.
그런데 몇 초 뒤에 슬그머니 다시 회색으로 돌아가는 걸 본 적이 있을 겁니다.

서버가 "좋아요 됐습니다"라고 답하기 전에 화면부터 바꿨다는 뜻입니다.
이걸 낙관적 업데이트(optimistic update)라고 부릅니다.
"아마 성공하겠지"라고 낙관하고 먼저 그린 다음, 실패하면 되돌리는 방식입니다.

원리는 한 줄로 끝나지만, 막상 만들어 보면 신경 쓸 곳이 꽤 많습니다.
실패하면 무엇으로 되돌리는지, 연타하면 어떻게 되는지, 서버 값과 어긋나면 어떻게 맞추는지입니다.

## 기다리는 방식과 먼저 그리는 방식

평범하게 만들면 이렇게 됩니다.

```jsx
async function handleClick() {
  setPending(true);
  const result = await api.setLike(postId, !liked);
  setLiked(result.liked);
  setCount(result.count);
  setPending(false);
}
```

응답이 와야 화면이 바뀝니다.
서버가 50ms 안에 답하면 차이를 못 느끼지만, 300ms만 넘어도 "눌렸나?" 싶어서 한 번 더 누르게 됩니다.
좋아요처럼 결과가 거의 항상 성공인 동작에 매번 이 대기 시간을 치르는 건 손해입니다.

낙관적 업데이트는 순서를 바꿉니다.

1. 지금 상태를 기억해 둔다.
2. 성공했다고 가정하고 화면을 바로 바꾼다.
3. 요청을 보낸다.
4. 성공하면 서버가 준 값으로 맞춘다. 실패하면 1에서 기억한 상태로 되돌리고 알린다.

```jsx
async function handleClick() {
  const prev = { liked, count };
  const next = !liked;

  setLiked(next);
  setCount((c) => c + (next ? 1 : -1));

  try {
    const result = await api.setLike(postId, next);
    setLiked(result.liked);
    setCount(result.count);
  } catch {
    setLiked(prev.liked);
    setCount(prev.count);
    toast('좋아요를 반영하지 못했습니다.');
  }
}
```

뼈대는 이게 전부입니다.
이제 이 코드에서 부족한 부분을 하나씩 채워 보겠습니다.

## 언제 쓰고 언제 쓰면 안 될까

먼저 짚을 점이 있습니다.
낙관적 업데이트는 "빠르게 보이는 기법"이기 전에 **확정되지 않은 결과를 먼저 보여 주는 기법**입니다.
그래서 예측이 틀렸을 때 피해가 작은 곳에만 써야 합니다.

잘 맞는 곳은 이런 동작입니다.

- 거의 항상 성공한다. (좋아요, 북마크, 체크박스, 읽음 표시)
- 실패해도 되돌리면 그만이다. 사용자가 그 결과를 믿고 다른 행동을 하지 않는다.
- 결과를 클라이언트가 정확히 예측할 수 있다. 토글 결과는 뻔합니다.

반대로 이런 곳에는 쓰지 않습니다.

- **결제, 송금, 주문.** "결제 완료"를 보고 사용자가 창을 닫았는데 사실 실패했다면 되돌릴 방법이 없습니다. 이런 동작은 기다리게 하고, 그 대신 진행 중임을 분명히 보여 주는 편이 맞습니다.
- **서버가 결과를 정하는 동작.** 재고 차감, 좌석 예약, 순번 발급처럼 다른 사용자와 경쟁하는 동작은 클라이언트가 결과를 알 수 없습니다.
- **실패가 흔한 동작.** 검증이 까다로운 폼 제출을 낙관적으로 처리하면 "저장됐다"가 수시로 뒤집혀서 오히려 신뢰를 잃습니다.
- **되돌리기가 화면을 크게 흔드는 동작.** 항목을 지웠다가 실패해서 목록 한가운데 다시 나타나면, 사용자는 무슨 일이 있었는지 알기 어렵습니다.

중간 지대도 있습니다.
채팅 메시지는 보내자마자 목록에 넣되, 흐리게 그리거나 "전송 중" 표시를 붙입니다.
실패하면 지우는 대신 "다시 보내기" 버튼을 붙입니다.
결과를 먼저 보여 주되 아직 확정이 아니라는 사실도 함께 알려 주는 방식입니다.

## 실패하면 무엇으로 되돌릴까

위 코드는 요청 직전의 상태를 `prev`에 담아 두었다가 실패하면 그 값으로 돌아갑니다.
가장 흔한 방식이고, 동작이 하나일 때는 문제가 없습니다.

되돌릴 때 기억할 점이 두 가지 있습니다.

첫째, **조용히 되돌리지 않습니다.**
하트가 말없이 회색으로 돌아가면 사용자는 자기가 잘못 눌렀다고 생각합니다.
짧은 알림이라도 남겨야 합니다.

둘째, **스냅숏으로 되돌리는 방식은 다른 변경까지 지울 수 있습니다.**
요청이 날아가는 사이에 다른 이유로 상태가 바뀌었다면, 실패 시 스냅숏을 덮어쓰는 순간 그 변경도 함께 사라집니다.
바로 다음에 볼 연타 문제가 대표적인 경우입니다.

## 연타하면 순서가 꼬입니다

하트를 빠르게 세 번 누른다고 해 봅시다.
좋아요, 취소, 좋아요. 최종 상태는 "좋아요"여야 합니다.

요청도 세 개가 나갑니다.
그런데 응답이 보낸 순서대로 온다는 보장은 없습니다.
첫 번째 요청의 응답이 가장 늦게 오면, 이미 지나간 상태가 마지막에 화면을 덮어씁니다.
API가 "토글" 방식이라면 더 나쁩니다.
서버에 도착한 순서에 따라 최종 상태 자체가 달라집니다.

여기에는 몇 가지 대책이 있고, 보통 함께 씁니다.

**토글이 아니라 목표 상태를 보냅니다.**
`POST /posts/1/like/toggle` 대신 `PUT /posts/1/like`와 `DELETE /posts/1/like`, 또는 `{ liked: true }`처럼 원하는 결과를 보냅니다.
같은 요청을 두 번 보내도 결과가 같은, 멱등한 요청이 됩니다.
도착 순서가 바뀌어도 최소한 "두 번 토글되어 반대로 뒤집히는" 일은 없습니다.

**오래된 응답으로 화면을 덮지 않습니다.**
요청마다 번호를 붙이고, 가장 최근 요청의 응답만 화면에 반영합니다.
실패했을 때도 마찬가지입니다. 이미 더 새로운 요청이 나갔다면 오래된 요청의 실패로 되돌리지 않습니다.

```jsx
// apply: 화면만 낙관적으로 바꾼다 / applyServer: 서버 값으로 화면을 맞춘다
const latest = useRef(0);

async function setLike(next) {
  const id = ++latest.current;
  const prev = snapshotRef.current; // 가장 최근에 확정된 서버 상태
  apply(next);

  try {
    const result = await api.setLike(postId, next);
    if (id !== latest.current) return; // 더 새로운 요청이 있다
    snapshotRef.current = result;
    applyServer(result);
  } catch {
    if (id !== latest.current) return;
    applyServer(prev);
    toast('좋아요를 반영하지 못했습니다.');
  }
}
```

**같은 대상에 대한 요청은 줄을 세웁니다.**
앞 요청이 끝나야 다음 요청을 보내면 서버 도착 순서가 보장됩니다.
화면은 계속 즉시 바뀌고, 네트워크만 순서대로 갑니다.
TanStack Query v5는 `useMutation`의 `scope: { id }` 옵션으로 같은 scope의 변경 요청을 차례로 실행해 줍니다.

요청 중에 버튼을 막는 방법도 있지만, 좋아요처럼 가벼운 동작에서는 "바로 바뀐다"는 장점을 스스로 버리는 일이라 마지막 수단으로 남겨 둡니다.

## 성공해도 서버 값으로 다시 맞춥니다

낙관적 업데이트에서 가장 흔한 오해는 "성공하면 내가 예측한 값이 맞으니 그대로 두면 된다"입니다.
좋아요 여부는 그렇지만, 좋아요 **수**는 아닙니다.
내가 누르는 사이 다른 사람도 눌렀다면 서버의 숫자는 내 예측보다 큽니다.

그래서 응답이 오면 서버가 돌려준 값으로 덮어쓰거나, 해당 데이터를 다시 가져옵니다.
낙관적 값은 응답이 오기 전까지만 쓰는 임시 값이고, 진짜 값은 언제나 서버에 있습니다.
이 관점을 잡아 두면 아래 두 API가 왜 그렇게 설계됐는지 쉽게 이해됩니다.

## React 19의 useOptimistic

React 19에는 이 패턴을 위한 훅 `useOptimistic`이 들어왔습니다.

```jsx
const [optimisticState, addOptimistic] = useOptimistic(state, updateFn);
```

- `state`: 진짜 상태입니다. 진행 중인 동작이 없으면 이 값이 그대로 나옵니다.
- `updateFn(currentState, optimisticValue)`: 낙관적 값을 받아 임시 상태를 계산합니다.
- `addOptimistic(value)`: 낙관적 변경을 겁니다. Action이나 `startTransition` 안에서 불러야 합니다.

핵심은 **임시 상태가 진행 중인 Action이 끝날 때까지만 유지된다**는 점입니다.
Action이 끝나면 React는 낙관적 값을 버리고 다시 `state`를 보여 줍니다.

```jsx
import { useOptimistic, useState, startTransition } from 'react';

function LikeButton({ postId, initial }) {
  const [like, setLike] = useState(initial); // { liked, count }
  const [optimistic, addOptimistic] = useOptimistic(
    like,
    (current, nextLiked) => ({
      liked: nextLiked,
      count: current.count + (nextLiked ? 1 : -1),
    }),
  );

  function handleClick() {
    const next = !optimistic.liked;
    startTransition(async () => {
      addOptimistic(next);
      try {
        const result = await api.setLike(postId, next);
        startTransition(() => setLike(result)); // 진짜 상태를 서버 값으로
      } catch {
        toast('좋아요를 반영하지 못했습니다.');
      }
    });
  }

  return (
    <button onClick={handleClick} aria-pressed={optimistic.liked}>
      {optimistic.liked ? '♥' : '♡'} {optimistic.count}
    </button>
  );
}
```

여기서 흔히 빠지는 함정이 두 가지 있습니다.

**성공했는데 원래대로 돌아가 버립니다.**
`addOptimistic`만 부르고 `setLike`로 진짜 상태를 바꾸지 않으면, Action이 끝나는 순간 화면은 이전 값으로 돌아갑니다.
`useOptimistic`은 값을 "유지해 주는" 훅이 아니라 "잠깐 덮어 보여 주는" 훅이기 때문입니다.
반대로 이 성질 덕분에 실패 시 롤백은 따로 할 필요가 없습니다. 진짜 상태를 바꾸지 않으면 저절로 원래 값이 나옵니다.

**`await` 뒤의 상태 변경은 따로 감싸야 합니다.**
React 문서는 `startTransition`에 넘긴 비동기 함수에서 `await` 이후의 상태 변경이 Transition으로 표시되지 않는다고 설명합니다.
그래서 위 코드처럼 `await` 뒤의 `setLike`를 다시 `startTransition`으로 감쌉니다.

또 Action 안에서 던져진 에러는 가장 가까운 Error Boundary로 올라갑니다.
좋아요 실패로 화면 전체가 에러 화면이 되면 곤란하니, 예상되는 실패는 Action 안에서 잡아 처리합니다.

`useOptimistic`은 컴포넌트 안의 상태와 Action에 잘 맞습니다.
여러 화면이 같은 서버 데이터를 공유하고, 캐시와 재요청까지 관리해야 한다면 다음 방식이 더 편합니다.

## TanStack Query의 onMutate 패턴

TanStack Query에서는 `useMutation`의 콜백으로 같은 순서를 구현합니다.
v5 기준 문서의 패턴은 이렇습니다.

```jsx
const queryClient = useQueryClient();

const mutation = useMutation({
  mutationFn: ({ postId, liked }) => api.setLike(postId, liked),

  onMutate: async ({ postId, liked }) => {
    const key = ['post', postId];
    // 1. 진행 중인 재요청이 낙관적 값을 덮어쓰지 않게 취소
    await queryClient.cancelQueries({ queryKey: key });
    // 2. 지금 값을 기억
    const previous = queryClient.getQueryData(key);
    // 3. 캐시를 낙관적으로 수정
    queryClient.setQueryData(key, (old) => ({
      ...old,
      liked,
      likeCount: old.likeCount + (liked ? 1 : -1),
    }));
    // 4. 되돌릴 때 쓸 값을 반환
    return { previous };
  },

  onError: (error, { postId }, context) => {
    queryClient.setQueryData(['post', postId], context.previous);
    toast('좋아요를 반영하지 못했습니다.');
  },

  onSettled: (data, error, { postId }) =>
    queryClient.invalidateQueries({ queryKey: ['post', postId] }),
});
```

단계마다 이유가 있습니다.

- `cancelQueries`: 마침 그 데이터를 다시 가져오는 중이었다면, 그 응답이 도착하면서 낙관적 값을 옛날 값으로 덮어씁니다. 그래서 먼저 취소합니다.
- `onMutate`의 반환값: `onError`와 `onSettled`의 세 번째 인자로 그대로 전달됩니다. 스냅숏을 여기에 담습니다.
- `onSettled`: 성공이든 실패든 끝나면 데이터를 다시 가져와 서버 값으로 맞춥니다. 콜백에서 `invalidateQueries`의 Promise를 반환하면 재요청이 끝날 때까지 mutation이 진행 중 상태로 남습니다.

연타 문제는 여기서도 똑같이 생깁니다.
첫 번째 요청의 `onSettled`가 다시 가져온 데이터가, 아직 끝나지 않은 두 번째 요청의 낙관적 값을 덮어쓸 수 있습니다.
TanStack Query 메인테이너 Dominik Dorfmeister는 블로그에서 같은 대상의 mutation이 마지막 하나 남았을 때만 무효화하는 방법을 소개합니다.
`mutationKey`를 붙여 두고 `queryClient.isMutating({ mutationKey })`가 1일 때만 `invalidateQueries`를 부르는 식입니다.
앞에서 말한 `scope`로 요청을 줄 세우는 것도 같은 문제를 다른 쪽에서 푸는 방법입니다.

캐시를 건드리지 않는 더 단순한 방식도 있습니다.
`useMutation`이 돌려주는 `variables`와 `isPending`을 이용해, 요청 중일 때만 화면에 임시 항목을 그리는 것입니다.
캐시는 그대로라서 롤백할 것이 없고, 그 화면 하나에서만 낙관적으로 보이면 충분할 때 잘 맞습니다.

## 정리

- 낙관적 업데이트는 응답을 기다리지 않고 성공을 가정해 먼저 그리고, 실패하면 되돌리는 방식입니다. 확정되지 않은 결과를 보여 주는 것이니 예측이 틀려도 피해가 작은 동작에만 씁니다.
- 결제, 주문, 재고처럼 되돌릴 수 없거나 서버가 결과를 정하는 동작에는 쓰지 않습니다. 대신 진행 중임을 분명히 보여 줍니다.
- 실패하면 되돌리되 반드시 알립니다. 스냅숏 롤백은 그 사이 생긴 다른 변경까지 지울 수 있다는 점을 기억합니다.
- 연타에는 목표 상태를 보내는 멱등한 API, 오래된 응답 무시, 요청 줄 세우기로 대응합니다.
- 낙관적 값은 임시 값입니다. 성공하면 서버가 준 값으로 다시 맞춥니다.
- React 19 `useOptimistic`은 Action이 끝나면 진짜 상태로 돌아갑니다. 진짜 상태를 갱신해야 값이 남습니다. TanStack Query에서는 `onMutate`에서 취소, 스냅숏, 캐시 수정을 하고 `onError`에서 되돌리고 `onSettled`에서 다시 가져옵니다.

## 참고

- [React - useOptimistic](https://react.dev/reference/react/useOptimistic)
- [React - useTransition](https://react.dev/reference/react/useTransition)
- [TanStack Query - Optimistic Updates](https://tanstack.com/query/latest/docs/framework/react/guides/optimistic-updates)
- [TanStack Query - useMutation](https://tanstack.com/query/latest/docs/framework/react/reference/useMutation)
- [TkDodo - Concurrent Optimistic Updates in React Query](https://tkdodo.eu/blog/concurrent-optimistic-updates-in-react-query)
