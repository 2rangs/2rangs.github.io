---
legacy_id: 7
slug: scheduler-api-posttask-yield
title: Scheduler API로 메인 스레드 작업 우선순위 다루기
summary: scheduler.postTask로 작업에 우선순위를 붙이고 scheduler.yield로 긴 작업을 쪼개 입력 지연을 줄이는 방법과, 지원하지 않는 브라우저에서 쓸 setTimeout 폴백을 다룬다.
tags: [Web API, 웹 성능, JavaScript]
date: 2024-12-16T07:39:10.427Z
comment_term: posts/Scheduler-API%EC%97%90-%EB%8C%80%ED%95%B4-%EC%95%8C%EC%95%84%EB%B3%B4%EC%9E%90
---

웹 애플리케이션이 커지면 이런 증상을 한 번쯤 만난다. 클릭했는데 반응이 늦고, 입력이 한 박자 늦게 찍히고, 스크롤이 순간 멈춘다. 대부분 원인은 같다. 브라우저의 메인 스레드는 하나뿐이고, 그 위에서 자바스크립트 실행과 렌더링, 입력 처리가 모두 차례를 기다리는데 무거운 작업 하나가 그 줄을 오래 붙잡고 있는 것이다.

Scheduler API(정식 명칭은 Prioritized Task Scheduling API)를 쓰면 이 순서에 직접 관여할 수 있다. 작업에 우선순위를 붙여 큐에 넣는 `scheduler.postTask()`, 실행 중인 작업이 잠시 메인 스레드를 양보하는 `scheduler.yield()` 두 가지를 쓰는 법과, 아직 지원하지 않는 브라우저에서의 대체 방법까지 다룬다.

## 기존 방식의 한계

지금까지 작업을 뒤로 미루는 대표적인 방법은 `setTimeout(fn, 0)`이었다.

```js
setTimeout(() => {
  console.log('작업 실행');
}, 0);
```

이 방식으로는 우선순위를 표현할 수 없다. 사용자 입력에 대한 반응이든 분석 로그 전송이든 모두 같은 태스크 큐에 들어간다. 또 양보한 뒤에는 줄의 맨 뒤로 간다. 긴 작업을 쪼개려고 `setTimeout`으로 끊으면, 그 사이에 들어온 다른 태스크(서드파티 스크립트 등)가 모두 끝난 뒤에야 이어서 실행된다. 게다가 중첩 호출이 깊어지면 브라우저가 최소 지연(약 4ms)을 강제한다.

`requestAnimationFrame`은 다음 프레임 렌더링 직전에 실행할 작업에, `requestIdleCallback`은 유휴 시간에 돌릴 작업에 맞춰져 있어서 "이 작업은 이 정도로 중요하다"를 일반적으로 표현하기엔 부족하다.

## scheduler.postTask

`scheduler.postTask()`는 콜백을 우선순위와 함께 예약하고, 콜백의 반환값으로 이행되는 Promise를 돌려준다.

```js
const result = await scheduler.postTask(() => {
  return computeSummary(data);
}, { priority: 'user-visible' });
```

우선순위는 세 가지다.

| 우선순위 | 용도 | 예시 |
| --- | --- | --- |
| `user-blocking` | 사용자가 결과를 기다리는 작업 | 입력에 대한 즉각적인 반응 |
| `user-visible` (기본값) | 화면에 보이지만 급하지 않은 작업 | 목록 일부 렌더링, 이미지 후처리 |
| `background` | 사용자가 의식하지 않는 작업 | 로그 전송, 캐시 정리, 프리페치 |

같은 시점에 예약된 작업이라면 우선순위가 높은 쪽이 먼저 실행된다.

```js
scheduler.postTask(() => console.log('데이터 동기화'), { priority: 'background' });
scheduler.postTask(() => console.log('UI 업데이트'), { priority: 'user-blocking' });

// 출력 순서: UI 업데이트 → 데이터 동기화
```

여기서 오해하기 쉬운 점이 있다. **우선순위는 "다음에 무엇을 실행할지"를 정할 뿐, 이미 실행 중인 작업을 중단시키지 않는다.** `background` 작업 하나가 300ms 동안 동기적으로 돈다면 그동안 들어온 `user-blocking` 작업도 기다려야 한다. 그래서 긴 작업은 반드시 쪼개야 하고, 그때 필요한 것이 뒤에서 다룰 `scheduler.yield()`다.

### 지연 실행과 취소

`delay` 옵션으로 지정한 시간 뒤에 큐에 넣을 수 있고, `TaskController`로 취소하거나 우선순위를 나중에 바꿀 수 있다.

```js
const controller = new TaskController({ priority: 'background' });

scheduler
  .postTask(() => prefetchNextPage(), { signal: controller.signal, delay: 1000 })
  .catch((error) => {
    if (error.name === 'AbortError') return; // 취소된 경우
    throw error;
  });

// 사용자가 다음 페이지 버튼에 마우스를 올리면 우선순위를 올린다
nextButton.addEventListener('pointerenter', () => {
  controller.setPriority('user-visible');
});

// 페이지를 떠나면 취소한다
controller.abort();
```

취소된 작업의 Promise는 `AbortError`로 거부되므로 `catch`로 처리해 두는 것이 좋다. 우선순위를 바꿀 필요가 없고 취소만 하면 된다면 일반 `AbortController`의 `signal`을 넘겨도 된다.

## scheduler.yield로 긴 작업 쪼개기

`scheduler.yield()`는 현재 작업을 잠시 멈추고 메인 스레드를 브라우저에 돌려준 뒤, 이어서 실행할 수 있게 해 주는 Promise를 반환한다. `setTimeout`으로 양보할 때와 달리 **이어지는 작업이 큐의 앞쪽에 배치**되기 때문에, 양보하는 동안 입력 처리나 렌더링은 끼어들 수 있지만 다른 일반 태스크에 순서를 빼앗기지는 않는다.

지원하지 않는 브라우저를 위해 `setTimeout`으로 대체하는 헬퍼를 두고 쓰면 된다.

```js
function yieldToMain() {
  if (globalThis.scheduler?.yield) {
    return scheduler.yield();
  }
  return new Promise((resolve) => setTimeout(resolve, 0));
}
```

수천 개의 항목을 처리해야 한다면, 일정 시간마다 양보하도록 루프를 짠다.

```js
async function processInChunks(items, processItem, budgetMs = 50) {
  let deadline = performance.now() + budgetMs;

  for (const item of items) {
    processItem(item);

    if (performance.now() >= deadline) {
      await yieldToMain();
      deadline = performance.now() + budgetMs;
    }
  }
}
```

50ms는 브라우저가 "긴 작업(long task)"으로 분류하는 기준이다. 매 항목마다 양보하면 오버헤드가 커지고, 너무 드물게 양보하면 입력 지연이 생기므로 시간 예산을 기준으로 끊는 편이 실용적이다. INP(Interaction to Next Paint) 지표를 개선할 때도 이 패턴을 가장 먼저 시도해 볼 만하다.

## 브라우저 지원과 대체 방안

작성 시점(2026년 11월) 기준으로 Chrome, Edge 등 Chromium 계열 브라우저는 `scheduler.postTask()`(Chrome 94부터)와 `scheduler.yield()`(Chrome 129부터)를 모두 지원한다. Firefox도 최근 버전에서 지원을 추가했지만, Safari는 아직 지원하지 않는 것으로 알고 있다. 지원 현황은 빠르게 바뀌므로 도입 전에 MDN의 호환성 표를 직접 확인하는 것이 안전하다.

따라서 실무에서는 기능 감지를 전제로 써야 한다. `window` 대신 `globalThis`를 쓰면 Web Worker에서도 같은 코드가 동작한다.

```js
const supportsPostTask = 'scheduler' in globalThis && 'postTask' in scheduler;
const supportsYield = 'scheduler' in globalThis && 'yield' in scheduler;
```

지원하지 않는 환경에서 가장 단순한 선택은 위의 `yieldToMain()`처럼 `setTimeout`으로 폴백하는 것이다. 동작은 같고 순서 보장만 포기하는데, 대부분의 경우 이것으로 충분하다. `scheduler.postTask`는 폴리필(`scheduler-polyfill` 패키지)도 있지만, 브라우저 내부 큐에 접근할 수는 없으므로 우선순위를 완벽하게 재현하지는 못한다.

계산 자체가 무겁다면 우선순위를 조정하기보다 Web Worker로 메인 스레드 밖으로 옮기는 편이 근본적이다. DOM에 접근하지 않는 파싱, 정렬, 집계 작업이 대상이다. React 내부의 렌더링이라면 React 18부터 들어간 `startTransition`, `useDeferredValue` 같은 동시성 기능이 렌더링 우선순위를 자체적으로 관리하므로 이쪽이 더 자연스럽다. `requestIdleCallback`은 정말 급하지 않은 작업에 쓸 수 있지만, Safari 지원이 없거나 제한적이니 마찬가지로 폴백이 필요하다.

## 실무에서 쓸 만한 곳

대시보드와 데이터 시각화가 대표적이다. 수천 개의 데이터 포인트를 가공하는 동안에도 필터 조작이 바로 반응해야 한다. 가공 루프에 `yieldToMain()`을 넣고, 차트 갱신은 `user-visible`, 통계 로그는 `background`로 나누는 식이다. 지도 위에 마커를 대량으로 올릴 때도 좌표 변환과 클러스터링을 청크 단위로 나눠 처리하면 지도 이동 중에 프레임이 끊기지 않는다. 초기 로딩 이후의 분석 스크립트 초기화, 다음 화면 프리페치, 캐시 워밍업처럼 첫 상호작용과 경쟁하면 안 되는 작업은 `background`로 미룬다.

## 도입할 때 주의할 점

모든 작업을 `user-blocking`으로 올리면 아무것도 우선하지 않는 것과 같다. 기본값인 `user-visible`을 기준으로, 정말 필요한 것만 올리고 내린다. 그리고 앞서 말했듯 우선순위는 실행 중인 작업을 멈추지 못하므로, 긴 동기 작업을 그대로 `postTask`에 넣는 것만으로는 반응성이 좋아지지 않는다. 쪼개야 의미가 있다.

두 API 모두 메인 스레드를 더 빠르게 만들어 주지는 않는다. 한정된 메인 스레드 시간을 사용자에게 중요한 일부터 쓰도록 배분할 뿐이다. 그러니 Chrome DevTools의 Performance 패널에서 긴 작업이 어디서 생기는지 먼저 확인하고, 적용 전후의 INP를 비교해 실제로 효과가 있는지 본다. 기능 감지와 `setTimeout` 폴백을 함께 두고, 지원하는 환경에서 점진적으로 이점을 얻는 방식으로 들이는 것이 현실적이다.

## 참고

- [MDN - Prioritized Task Scheduling API](https://developer.mozilla.org/en-US/docs/Web/API/Prioritized_Task_Scheduling_API)
- [MDN - Scheduler.postTask()](https://developer.mozilla.org/en-US/docs/Web/API/Scheduler/postTask)
- [MDN - Scheduler.yield()](https://developer.mozilla.org/en-US/docs/Web/API/Scheduler/yield)
- [web.dev - Optimize long tasks](https://web.dev/articles/optimize-long-tasks)
