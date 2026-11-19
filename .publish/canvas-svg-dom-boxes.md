
사진 한 장 위에 사람, 자동차, 신호등을 표시하는 화면을 만든다고 해 보겠습니다.
객체 탐지 모델이 돌려준 결과를 네모 박스로 그리는 거죠.
박스가 열 개면 아무 방법이나 됩니다.
그런데 수천 개가 되면 고민이 시작됩니다.

웹에서 이런 박스를 그리는 방법은 크게 셋입니다.
DOM, SVG, Canvas.
하나씩 써 보면서 차이를 보겠습니다.

## DOM으로 그리기

가장 익숙한 방법입니다.
이미지를 감싼 요소를 `position: relative`로 두고, 박스마다 `div`를 절대 위치로 올립니다.

```html
<div class="stage">
  <img src="/photo.jpg" alt="" />
  <div class="box" style="left: 120px; top: 40px; width: 80px; height: 160px"></div>
</div>
```

```css
.stage { position: relative; display: inline-block; }
.box { position: absolute; border: 2px solid #ef4444; box-sizing: border-box; }
```

장점이 많습니다.
CSS로 꾸미기 쉽고, `:hover`도 되고, 라벨 텍스트도 그냥 넣으면 됩니다.
스크린 리더나 키보드 접근성도 챙기기 쉽습니다.

단점은 개수입니다.
요소마다 스타일과 레이아웃 계산이 따라붙으니, 수천 개를 한꺼번에 움직이거나 확대하면 버거워집니다.

## SVG로 그리기

SVG는 박스를 `<rect>`로 그립니다.
`viewBox`를 원본 이미지 크기로 맞추면, 탐지 결과 좌표를 그대로 넣을 수 있다는 게 큰 장점입니다.

```html
<svg viewBox="0 0 1920 1080" style="width: 100%; height: auto">
  <image href="/photo.jpg" width="1920" height="1080" />
  <rect x="120" y="40" width="80" height="160"
        fill="none" stroke="#ef4444" stroke-width="2"
        vector-effect="non-scaling-stroke" />
</svg>
```

화면 크기가 바뀌어도 좌표를 다시 계산할 필요가 없습니다.
`vector-effect="non-scaling-stroke"`를 주면 확대해도 선 두께가 그대로라 보기 좋습니다.
각 `<rect>`가 DOM 요소라 클릭 이벤트도 바로 붙습니다.

하지만 SVG 요소도 DOM 요소입니다.
개수가 아주 많아지면 DOM 방식과 비슷한 부담이 생깁니다.

## Canvas로 그리기

Canvas는 요소가 아니라 픽셀을 그립니다.
박스가 몇 개든 화면에 있는 건 `<canvas>` 하나뿐입니다.

```js
const canvas = document.querySelector('canvas');
const ctx = canvas.getContext('2d');

function draw(boxes) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (const b of boxes) {
    ctx.rect(b.x, b.y, b.w, b.h);
  }
  ctx.stroke();
}
```

모든 박스를 경로 하나에 모은 뒤 `stroke()`를 한 번만 부르는 게 요령입니다.
MDN의 캔버스 최적화 문서도 그리기 호출을 묶으라고 권합니다.
같은 문서에서 정수 좌표를 쓰고, `shadowBlur`는 되도록 피하라고도 합니다.

대신 잃는 것도 있습니다.
박스는 그냥 픽셀이라, 어떤 박스를 클릭했는지 브라우저가 알려 주지 않습니다.
접근성도 직접 챙겨야 합니다.

## 클릭한 박스 찾기

DOM과 SVG는 이벤트의 `target`이 곧 박스입니다.
Canvas는 직접 계산해야 합니다.
네모 박스라면 단순한 범위 비교로 충분합니다.

```js
canvas.addEventListener('click', (e) => {
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  // 위에 그린 박스부터 확인
  for (let i = boxes.length - 1; i >= 0; i--) {
    const b = boxes[i];
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
      console.log('선택', b);
      break;
    }
  }
});
```

여기서 `boxes`의 좌표는 화면(CSS 픽셀) 기준이라고 가정했습니다.
원본 이미지 좌표라면 표시 크기에 맞게 비율을 곱해 줘야 합니다.

다각형처럼 모양이 복잡하면 `Path2D`와 `isPointInPath()`를 쓸 수 있습니다.
MDN에 따르면 `isPointInPath(path, x, y)`의 x, y는 컨텍스트의 현재 변환과 상관없는 좌표입니다.
즉 캔버스의 실제 픽셀 좌표를 넘겨야 하고, 아래에서 볼 `devicePixelRatio`까지 곱해야 합니다. 자주 헷갈리는 부분입니다.

박스가 수만 개라 순회도 느리다면, 화면을 격자로 나눠 칸마다 박스 목록을 들고 있는 식으로 후보를 줄이면 됩니다.

## 흐릿한 캔버스와 devicePixelRatio

Canvas로 바꿨더니 선이 뿌옇게 보인다면 `devicePixelRatio` 문제일 가능성이 큽니다.
MDN에 따르면 이 값은 CSS 픽셀 하나에 실제 화면 픽셀이 몇 개 들어가는지를 나타냅니다.
고해상도 화면에서는 1보다 크죠.

그래서 캔버스의 내부 크기는 키우고, 보이는 크기는 CSS로 맞춥니다.

```js
function setupCanvas(canvas, width, height) {
  const dpr = window.devicePixelRatio || 1;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);

  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // 이후 그리기는 CSS 픽셀 기준
  return ctx;
}
```

MDN 예시는 `ctx.scale(dpr, dpr)`를 씁니다.
여기서는 `setTransform`을 썼는데, 창 크기가 바뀌어 다시 호출해도 배율이 겹쳐 쌓이지 않아서입니다.

> **참고** 브라우저 창을 다른 모니터로 옮기거나 확대 비율을 바꾸면 `devicePixelRatio`도 바뀔 수 있습니다. 그럴 땐 캔버스를 다시 설정하고 다시 그려야 선명함이 유지됩니다.

## 무엇을 고를까

- 박스가 적고 라벨, 버튼, 접근성이 중요함: DOM
- 원본 좌표를 그대로 쓰고 싶고 개수가 적당함: SVG
- 박스가 아주 많거나 자주 다시 그림: Canvas

섞어 쓰는 것도 좋은 방법입니다.
박스 수천 개는 Canvas로 그리고, 선택한 박스 하나의 라벨과 버튼만 DOM으로 올리는 식이죠.
저는 이 조합이 가장 손이 덜 가더라고요.

## 정리

세 방식의 차이는 "박스 하나가 요소인가, 픽셀인가"입니다.
요소는 편하지만 무겁고, 픽셀은 가볍지만 할 일이 늘어납니다.
데이터 양을 보고 고르면 됩니다.

## 참고

- [MDN, Optimizing canvas](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas)
- [MDN, Window.devicePixelRatio](https://developer.mozilla.org/en-US/docs/Web/API/Window/devicePixelRatio)
- [MDN, CanvasRenderingContext2D.isPointInPath()](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/isPointInPath)
- [MDN, vector-effect](https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Attribute/vector-effect)
