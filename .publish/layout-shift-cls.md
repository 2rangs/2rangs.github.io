
글을 읽는데 문단이 갑자기 아래로 내려갑니다. 위쪽에 이미지가 늦게 들어왔기 때문입니다. "취소" 버튼을 누르려는 순간 배너가 끼어들어 그 자리에 있던 "결제"가 눌리기도 합니다.

이렇게 사용자가 아무것도 하지 않았는데 보이던 요소의 위치가 바뀌는 현상을 레이아웃 이동(layout shift)이라고 합니다. Core Web Vitals 지표 중 하나인 CLS(Cumulative Layout Shift)가 이를 수치로 잽니다.

## CLS는 어떻게 계산될까

레이아웃 이동 하나의 점수는 두 값을 곱해서 구합니다. 영향 비율(impact fraction)은 움직인 요소들이 이동 전과 후에 차지한 영역을 합친 넓이가 뷰포트에서 차지하는 비율이고, 거리 비율(distance fraction)은 요소가 움직인 가장 먼 거리를 뷰포트의 긴 변으로 나눈 값입니다.

뷰포트의 절반을 차지하는 본문이 뷰포트 높이의 4분의 1만큼 밀리면, 이동 전후 영역을 합친 영향 비율은 0.75, 거리 비율은 0.25, 점수는 약 0.19입니다.

CLS는 페이지가 열려 있는 동안 생긴 이동을 세션 창(session window)으로 묶어 계산합니다. 이동 사이 간격이 1초 미만이면 같은 창에 묶이고, 한 창은 최대 5초입니다. 점수 합이 가장 큰 창의 값이 그 페이지의 CLS입니다. 처음에는 페이지 전체의 이동을 모두 더했는데, 오래 열어 두는 페이지가 불리해서 2021년에 지금 방식으로 바뀌었습니다.

기준은 0.1 이하면 좋음, 0.25를 넘으면 나쁨입니다. 실제 사용자 방문의 75번째 백분위수로 판단합니다.

흔히 오해하는 부분도 있습니다. 새 요소가 나타나기만 해서는 이동이 아닙니다. 이미 화면에 있던 요소의 시작 위치가 바뀌어야 이동이고, 페이지 맨 아래에 무언가 추가되어 아무것도 밀지 않으면 점수는 0입니다. `transform` 애니메이션은 레이아웃을 바꾸지 않으므로 이동으로 세지 않지만, 같은 움직임을 `top`이나 `margin`으로 만들면 셉니다.

사용자 입력 직후 500ms 안의 이동은 제외되는데, 이건 아래에서 자세히 봅니다. 그리고 로딩 중에만 생기는 문제가 아닙니다. 무한 스크롤, 늦게 뜨는 쿠키 배너, 탭 전환처럼 페이지를 쓰는 도중에 생긴 이동도 포함됩니다.

## 원인 1. 크기를 모르는 이미지

가장 흔한 원인입니다.

```html
<img src="/photo.jpg" alt="산책로 사진" />
```

브라우저는 이미지 파일의 앞부분을 받기 전까지 이미지 크기를 모릅니다. 그래서 일단 높이 0으로 배치했다가, 크기를 알게 되는 순간 그만큼 아래 내용을 밀어냅니다.

`width`와 `height` 속성을 적으면 해결됩니다.

```html
<img src="/photo.jpg" alt="산책로 사진" width="1200" height="800" />
```

```css
img {
  max-width: 100%;
  height: auto;
}
```

반응형이라 크기가 바뀌는데 고정 크기를 적으면 안 되지 않느냐는 오해가 있습니다. 요즘 브라우저는 `width`와 `height` 속성으로 **비율**을 계산합니다. 기본 스타일에 `aspect-ratio: auto 1200 / 800`에 해당하는 값이 들어가서, CSS로 너비가 줄어들면 높이도 비율대로 계산해 이미지가 오기 전에 자리를 잡습니다. 속성의 숫자가 실제 표시 크기일 필요는 없고 비율만 맞으면 됩니다. CSS에서 `height: auto`를 함께 써야 속성의 높이 값이 그대로 고정되지 않습니다.

동영상 임베드나 지도 영역처럼 속성으로 비율을 줄 수 없는 요소는 CSS로 직접 지정합니다.

```css
.video-embed {
  width: 100%;
  aspect-ratio: 16 / 9;
}
```

## 원인 2. 늦게 들어오는 광고, 배너, 임베드

광고, 공지 배너, SNS 임베드는 크기를 미리 알기 어렵고 늦게 도착합니다. 본문 위에 끼어들면 그 아래 전부가 밀립니다.

자리를 먼저 잡아 두면 됩니다.

```css
.ad-slot {
  min-height: 250px; /* 가장 자주 들어오는 크기에 맞춘다 */
}
```

광고가 오지 않으면 빈 공간이 남습니다. 그 공간을 없애려고 높이를 0으로 접으면 그 접힘이 또 이동이 됩니다. 빈 자리에 자리 표시를 남겨 두는 편이 낫습니다.

공지 배너나 "새 글이 있습니다" 알림처럼 늦게 결정되는 UI는 위치를 바꾸는 것도 방법입니다. 본문을 미는 대신 화면 위에 겹쳐서(`position: fixed`) 띄우거나, 꼭 흐름 안에 넣어야 한다면 보이는 내용을 밀지 않도록 아래쪽에 넣습니다. 서버에서 배너 여부를 알 수 있다면 첫 HTML에 포함시켜 처음부터 자리를 차지하게 합니다.

스켈레톤 UI도 자리 예약의 한 방법입니다. 하지만 스켈레톤과 실제 콘텐츠의 높이가 다르면 교체되는 순간 이동이 생깁니다. 스켈레톤은 그럴듯한 모양보다 실제와 같은 크기가 중요합니다.

## 원인 3. 웹폰트 교체

`font-display: swap`을 쓰면 웹폰트를 받는 동안 대체 폰트로 글자를 먼저 보여 줍니다. 그런데 대체 폰트와 웹폰트는 글자 폭과 줄 높이가 다릅니다. 웹폰트로 바뀌는 순간 줄바꿈 위치가 달라지고 문단 높이가 변하면서 아래 내용이 밀립니다.

줄이는 방법은 몇 가지입니다.

- 첫 화면에 쓰는 폰트 파일을 `<link rel="preload" href="..." as="font" type="font/woff2" crossorigin>`으로 일찍 받아, 교체가 일어나기 전에 도착하게 합니다. 폰트 preload에는 같은 출처여도 `crossorigin`이 필요합니다.
- `font-display: optional`을 쓰면 아주 짧은 시간 안에 폰트가 오지 않을 경우 그 페이지에서는 대체 폰트를 계속 씁니다. 교체 자체가 없으니 이동도 없습니다. 대신 첫 방문에서는 웹폰트가 안 보일 수 있습니다.
- 대체 폰트의 크기를 웹폰트에 맞춥니다. `@font-face`의 `size-adjust`, `ascent-override`, `descent-override`로 로컬 폰트의 지표를 조정할 수 있습니다.

```css
@font-face {
  font-family: 'Brand Fallback';
  src: local('Malgun Gothic'), local('Apple SD Gothic Neo');
  size-adjust: 98%;       /* 값은 예시. 두 폰트를 겹쳐 보며 맞춘다 */
  ascent-override: 92%;
  descent-override: 24%;
}

body {
  font-family: 'Brand', 'Brand Fallback', sans-serif;
}
```

대체 폰트가 웹폰트와 거의 같은 공간을 차지하면 교체가 일어나도 줄바꿈이 크게 달라지지 않습니다. Next.js의 `next/font`처럼 이 값을 자동으로 계산해 주는 도구도 있습니다.

## 원인 4. 자바스크립트로 끼워 넣는 콘텐츠

데이터를 받아 목록 위에 항목을 추가하거나, 높이가 작은 로딩 스피너를 높이가 큰 결과 목록으로 바꾸는 경우도 흔합니다. 결과가 들어올 영역에는 예상 높이만큼 `min-height`를 줍니다. 위쪽에 항목을 끼워 넣는 대신 "새 항목 보기" 버튼을 띄우고 사용자가 누를 때 넣는 방법도 있는데, 누른 직후의 이동은 아래에서 보듯 점수에 들어가지 않습니다.

위치나 크기를 바꾸는 애니메이션은 `transform`으로 만듭니다. 펼침 효과를 `height` 애니메이션으로 만들면 그 아래 모든 요소가 매 프레임 이동합니다.

## 사용자 입력 직후 500ms는 예외입니다

아코디언을 눌러 펼치면 아래 내용이 밀립니다. 사용자가 원해서 생긴 변화이니 나쁜 이동이라고 할 수 없습니다.

그래서 클릭, 탭, 키 입력 같은 개별 입력 후 500ms 안에 생긴 이동은 CLS에서 빠집니다. API에서는 그런 이동 기록의 `hadRecentInput` 값이 `true`로 표시됩니다.

이 예외에는 경계가 있습니다. 스크롤이나 마우스 이동은 입력으로 치지 않으므로, 스크롤하다가 늦게 로드된 이미지가 내용을 밀어내면 그대로 점수에 들어갑니다. 또 500ms가 지나면 예외가 끝납니다. 버튼을 누른 뒤 서버 응답을 기다렸다가 1초 뒤에 내용이 바뀌면 그 이동은 셉니다. 응답이 느릴 것 같으면 누르는 즉시 결과가 들어갈 자리를 로딩 상태로 먼저 잡아 두세요. 펼침 애니메이션이 500ms보다 길어도 뒷부분의 이동은 셉니다.

## 측정하기

### DevTools에서 보기

Chrome DevTools에서는 몇 가지 방법으로 이동을 찾을 수 있습니다.

- **Rendering 패널의 Layout Shift Regions**: 켜 두면 이동이 생긴 영역이 잠깐 강조 표시됩니다. 페이지를 쓰면서 눈으로 찾기 좋습니다.
- **Performance 패널**: 기록하면 타임라인에 레이아웃 이동이 표시되고, 선택하면 어떤 요소가 움직였는지 볼 수 있습니다.
- **Lighthouse**: 페이지 로드 구간의 이동만 잽니다. 로드 이후 상호작용 중에 생기는 이동은 놓치기 때문에, Lighthouse 점수가 좋아도 실제 사용자 CLS는 나쁠 수 있습니다.

### 코드로 기록하기

Layout Instability API로 이동을 직접 관찰할 수 있습니다.

```js
const observer = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    if (entry.hadRecentInput) continue;
    console.log('이동 점수', entry.value.toFixed(4));
    for (const source of entry.sources) {
      console.log('움직인 요소', source.node, source.previousRect, source.currentRect);
    }
  }
});

observer.observe({ type: 'layout-shift', buffered: true });
```

`buffered: true`를 주면 관찰을 시작하기 전에 이미 일어난 이동도 받을 수 있습니다. `sources`에는 움직인 요소(최대 5개)와 이동 전후 위치가 들어 있어 원인을 찾을 때 유용합니다. 요소가 이미 DOM에서 사라졌다면 `source.node`는 `null`일 수 있습니다.

주의할 점이 두 가지 있습니다.

첫째, 위 코드의 값을 단순히 더하면 CLS가 아닙니다. 앞에서 말한 세션 창 계산을 해야 합니다. 실제 사용자 데이터를 모을 때는 직접 구현하기보다 Google Chrome 팀의 `web-vitals` 라이브러리를 쓰는 편이 정확합니다.

```js
import { onCLS } from 'web-vitals';

onCLS((metric) => {
  navigator.sendBeacon('/analytics', JSON.stringify({ name: metric.name, value: metric.value }));
});
```

둘째, 이 API는 작성 시점 기준 Chromium 계열 브라우저에서만 지원됩니다. Safari와 Firefox 사용자의 이동은 측정되지 않으니, 이 수치가 전체 사용자를 대표하지는 않습니다. 지원 현황은 MDN에서 확인하세요.

## 참고

- [web.dev - Cumulative Layout Shift (CLS)](https://web.dev/articles/cls)
- [web.dev - Optimize Cumulative Layout Shift](https://web.dev/articles/optimize-cls)
- [MDN - LayoutShift](https://developer.mozilla.org/en-US/docs/Web/API/LayoutShift)
- [MDN - aspect-ratio](https://developer.mozilla.org/en-US/docs/Web/CSS/aspect-ratio)
- [MDN - size-adjust](https://developer.mozilla.org/en-US/docs/Web/CSS/@font-face/size-adjust)
- [GoogleChrome/web-vitals](https://github.com/GoogleChrome/web-vitals)
