
쇼핑몰 탭을 닫은 지 한참 지났습니다. 그런데 화면 구석에 "장바구니에 담은 상품이 할인 중이에요" 알림이 뜹니다.

분명히 탭은 닫았습니다. 페이지의 자바스크립트도 다 멈췄을 텐데, 누가 이 알림을 띄운 걸까요?

답은 **서비스 워커**입니다. 페이지와 따로 도는 작은 스크립트예요. 오늘은 이 스크립트의 생명주기와 할 수 있는 일을 보겠습니다.

## 페이지 밖에서 도는 스크립트

MDN에 따르면 서비스 워커는 워커 컨텍스트에서 돌아갑니다.

- DOM에 접근할 수 없고, `localStorage` 같은 Web Storage도 쓸 수 없습니다.
- 페이지의 메인 스크립트와 다른 스레드에서 돌아갑니다.
- HTTPS 같은 보안 컨텍스트에서만 동작합니다. 개발용으로 `http://localhost`는 예외예요.

가장 중요한 점은 **페이지가 없어도 브라우저가 깨워서 실행할 수 있다**는 겁니다.

## 생명주기

페이지에서 `navigator.serviceWorker.register("/sw.js")`로 등록하면 다운로드, 설치(`install`), 활성화(`activate`) 순서를 거칩니다. 설치 때는 보통 캐시를 준비하고, 활성화 때는 이전 버전이 남긴 캐시를 정리합니다.

헷갈리는 건 새 버전을 배포할 때입니다. MDN에 따르면 새 버전은 백그라운드에서 설치만 되고 **대기 상태**로 남습니다. 예전 버전을 쓰는 페이지가 모두 닫혀야 활성화돼요. "배포했는데 왜 그대로지?"는 대부분 이것 때문입니다.

`skipWaiting()`과 `clients.claim()`으로 바로 교체할 수도 있지만, 열려 있던 페이지가 중간에 새 워커를 만나게 되니 신중하게 쓰는 게 좋아요.

또 MDN은 서비스 워커가 **할 일이 없으면 언제든 종료될 수 있다**고 설명합니다. 이벤트가 오면 다시 시작되고요. 그래서 전역 변수에 상태를 들고 있으면 안 됩니다.

## 알림이 도착하기까지

푸시 알림은 서비스 워커, Push API, Notifications API가 함께 일합니다.

1. 사용자가 알림을 허락합니다.
2. 페이지가 `pushManager.subscribe()`로 구독을 만듭니다. 푸시 서비스 주소(endpoint)와 암호화 키가 들어 있어요.
3. 이 구독 정보를 우리 서버에 저장합니다.
4. 알릴 일이 생기면 서버가 그 endpoint로 메시지를 보냅니다.
5. 브라우저가 메시지를 받고 서비스 워커를 깨워 `push` 이벤트를 보냅니다.
6. 서비스 워커가 `showNotification()`으로 알림을 띄웁니다.

탭이 닫혀 있어도 되는 이유가 5번입니다. 메시지를 받는 건 페이지가 아니라 브라우저예요.

## 권한 묻고 구독하기

권한 요청은 꼭 **버튼 클릭 같은 사용자 동작** 안에서 합니다. MDN도 그렇게 권하고 있어요.

```js
// main.js
const VAPID_PUBLIC_KEY = "서버에서 만든 공개 키";

document.querySelector("#subscribe").addEventListener("click", async () => {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return;

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: VAPID_PUBLIC_KEY,
  });

  await fetch("/api/push-subscriptions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(subscription),
  });
});
```

`userVisibleOnly: true`는 "푸시를 받으면 반드시 사용자에게 보이게 하겠다"는 약속입니다. MDN에 따르면 Chrome, Edge 같은 브라우저는 이 값이 `true`가 아니면 구독을 거절합니다.

`applicationServerKey`는 VAPID 공개 키입니다. 서버는 짝이 되는 개인 키로 서명해서 메시지를 보냅니다.

> **참고** MDN에 따르면 endpoint 주소만 알면 누구든 그 구독으로 메시지를 보낼 수 있습니다. 구독 정보는 비밀번호처럼 서버에만 안전하게 보관하세요.

## 서비스 워커에서 알림 띄우기

```js
// sw.js
self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};

  event.waitUntil(
    self.registration.showNotification(data.title ?? "새 소식", {
      body: data.body,
      data: { url: data.url ?? "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data.url));
});
```

여기서 `event.waitUntil()`이 아주 중요합니다. MDN에 따르면 이 메서드는 "아직 할 일이 있으니 종료하지 말라"고 브라우저에 알립니다. 빠뜨리면 알림을 띄우기 전에 워커가 멈출 수 있어요.

web.dev 문서에 따르면 Chrome은 `waitUntil()`에 넘긴 작업이 끝났는데도 알림이 없으면 "This site has been updated in the background." 같은 기본 알림을 대신 띄웁니다. 저도 프로미스 하나를 놓쳐서 이 알림을 한참 구경했습니다.

## 할 수 있는 것과 없는 것

페이지가 닫혀 있어도 알림을 띄우고, 누르면 원하는 페이지를 열 수 있습니다. 대신 조심할 것도 많아요.

- 사용자가 거절하면(`denied`) 알림을 띄울 수 없습니다. 다시 허용하려면 보통 사용자가 브라우저 설정에서 직접 바꿔야 하니, 처음 묻는 타이밍이 중요해요.
- 알림 없는 조용한 푸시는 마음대로 쓸 수 없습니다. 앞에서 본 `userVisibleOnly` 외에도, MDN에 따르면 Firefox는 알림을 띄우지 않는 메시지에 횟수 제한을 둡니다.
- 브라우저 프로세스가 완전히 꺼져 있을 때도 알림이 오는지는 브라우저와 운영체제에 따라 다릅니다.

iOS는 특히 조건을 잘 봐야 합니다. WebKit 공식 블로그에 따르면 iOS와 iPadOS 16.4부터 **홈 화면에 추가한 웹 앱**에서 웹 푸시를 지원합니다. 권한 요청도 사용자 동작에 대한 응답이어야 하고요. 일반 사파리 탭에서 바로 되는 기능으로 생각하면 안 되고, 세부 지원 범위는 바뀔 수 있으니 공식 문서를 꼭 확인하세요.

## 정리

탭을 닫아도 알림이 오는 건 페이지가 살아 있어서가 아닙니다. 브라우저가 메시지를 받고, 잠들어 있던 서비스 워커를 잠깐 깨워 알림을 띄우는 거예요. 할 수 있는 일이 큰 만큼 권한은 꼭 필요할 때, 사용자가 직접 눌렀을 때만 묻는 게 예의 아닐까요?

## 참고

- [Service Worker API | MDN](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [ExtendableEvent.waitUntil() | MDN](https://developer.mozilla.org/en-US/docs/Web/API/ExtendableEvent/waitUntil)
- [Push API | MDN](https://developer.mozilla.org/en-US/docs/Web/API/Push_API)
- [PushManager.subscribe() | MDN](https://developer.mozilla.org/en-US/docs/Web/API/PushManager/subscribe)
- [Using the Notifications API | MDN](https://developer.mozilla.org/en-US/docs/Web/API/Notifications_API/Using_the_Notifications_API)
- [Handling push messages | web.dev](https://web.dev/articles/push-notifications-handling-messages)
- [Web Push for Web Apps on iOS and iPadOS | WebKit](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)
