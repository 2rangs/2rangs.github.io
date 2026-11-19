
이미지는 대부분의 웹페이지에서 가장 많은 바이트를 차지하는 리소스다. 최적화하지 않은 이미지는 로딩을 늦추고, 레이아웃을 흔들고, 모바일 사용자의 데이터를 낭비한다. 특히 히어로 이미지처럼 화면에서 가장 큰 요소는 Core Web Vitals의 LCP(Largest Contentful Paint)를 직접 좌우하므로, 사용자 경험과 검색 노출 모두에 영향을 준다.

이 글에서는 이미지 최적화를 다섯 단계로 나눠 정리한다. 알맞은 포맷 고르기, 화면에 맞는 크기 내려 주기, 파일 압축, 필요한 시점에 불러오기, 가까운 서버에서 전달하기다.

## 이미지 포맷 고르기

같은 이미지라도 포맷에 따라 파일 크기가 크게 달라진다.

| 포맷 | 압축 | 투명도 | 적합한 용도 |
| --- | --- | --- | --- |
| JPEG | 손실 | 미지원 | 사진. 가장 호환성이 좋은 폴백 |
| PNG | 무손실 | 지원 | 스크린샷, 선명한 경계가 중요한 그래픽 |
| WebP | 손실·무손실 | 지원 | JPEG·PNG의 대체 |
| AVIF | 손실·무손실 | 지원 | 사진 위주에서 더 높은 압축률 |
| SVG | 벡터 | 지원 | 아이콘, 로고, 단순한 일러스트 |

Google의 측정에 따르면 손실 WebP는 같은 화질의 JPEG보다 25~34% 정도 작다. AVIF는 보통 WebP보다 더 작게 압축되지만 인코딩이 느리다는 단점이 있다. WebP와 AVIF 모두 현재 주요 브라우저에서 지원되므로, 사진은 AVIF나 WebP를 기본으로 하고 JPEG를 폴백으로 두는 구성이 무난하다. 아이콘과 로고는 래스터 포맷보다 SVG가 대부분 더 작고 선명하다.

## 반응형 이미지

### 포맷 협상은 picture로

`<picture>`의 `<source>`는 위에서부터 순서대로 검사되고, 브라우저가 처음으로 지원하는 `type`의 이미지를 고른다. 어떤 것도 지원하지 않으면 `<img>`의 `src`를 쓴다.

```html
<picture>
  <source srcset="photo.avif" type="image/avif" />
  <source srcset="photo.webp" type="image/webp" />
  <img src="photo.jpg" alt="해 질 녘의 한강 공원" width="1200" height="800" />
</picture>
```

### 크기 선택은 srcset과 sizes로

포맷만 바꿔서는 부족하다. 휴대폰 화면에 1600px짜리 이미지를 내려보내면 대부분의 바이트가 낭비된다. `srcset`에 너비 서술자(`w`)로 여러 크기를 나열하고, `sizes`로 이미지가 화면에서 차지할 폭을 알려 주면 브라우저가 화면 폭과 픽셀 밀도를 고려해 가장 알맞은 파일을 고른다.

```html
<img
  src="photo-800.jpg"
  srcset="photo-400.jpg 400w, photo-800.jpg 800w, photo-1600.jpg 1600w"
  sizes="(min-width: 1024px) 50vw, 100vw"
  alt="해 질 녘의 한강 공원"
  width="1600"
  height="1067"
/>
```

`sizes`는 "1024px 이상에서는 화면 폭의 절반, 그 외에는 화면 전체 폭"이라는 뜻이다. 두 방식은 함께 쓸 수 있다. `<source>`에도 `srcset`과 `sizes`를 넣으면 포맷과 크기를 동시에 고르게 할 수 있다.

### width와 height는 꼭 적는다

`width`와 `height` 속성을 생략하면 이미지가 로드되기 전까지 브라우저가 높이를 알 수 없어서, 이미지가 뜨는 순간 아래 콘텐츠가 밀려난다. CLS(Cumulative Layout Shift)를 키우는 대표적인 원인이다. 속성으로 원본 비율만 알려 주면 브라우저가 공간을 미리 확보하고, CSS의 `width: 100%; height: auto;`와 함께 써도 비율이 유지된다.

## 압축과 변환

### 도구

한두 장이라면 브라우저에서 바로 쓰는 도구로 충분하다.

- [Squoosh](https://squoosh.app/): 포맷과 품질을 바꿔 가며 원본과 나란히 비교할 수 있다.
- [TinyPNG](https://tinypng.com/): PNG, JPEG, WebP를 간단히 압축한다.

### sharp로 자동화하기

이미지가 많다면 빌드 단계에서 자동으로 변환하는 편이 낫다. Node.js에서는 [sharp](https://sharp.pixelplumbing.com/)가 대표적이다. 아래 스크립트는 원본 하나로 여러 너비의 AVIF와 WebP를 한 번에 만든다.

```js
// optimize-images.mjs
import sharp from 'sharp';

const widths = [400, 800, 1600];

for (const width of widths) {
  const image = sharp('input.jpg').resize({ width, withoutEnlargement: true });

  await image.clone().avif({ quality: 50 }).toFile(`photo-${width}.avif`);
  await image.clone().webp({ quality: 80 }).toFile(`photo-${width}.webp`);
}
```

`withoutEnlargement`는 원본보다 큰 크기로 늘리지 않게 한다. 품질 값은 포맷마다 의미가 달라서 AVIF는 WebP보다 낮은 숫자에서도 비슷한 화질이 나온다. 적당한 값은 실제 이미지로 비교해 보고 정한다.

## 지연 로딩

### loading="lazy"

화면 밖에 있는 이미지는 사용자가 스크롤해서 가까워질 때 불러오면 된다. 지금은 HTML 속성 하나로 충분하다.

```html
<img src="photo.jpg" loading="lazy" alt="해 질 녘의 한강 공원" width="1200" height="800" />
```

브라우저가 뷰포트와의 거리를 판단해 적당한 시점에 요청을 보낸다.

### 첫 화면 이미지는 지연하지 않는다

모든 이미지에 지연 로딩을 일괄 적용하는 것은 흔한 실수다. 첫 화면에 보이는 이미지, 특히 LCP 요소에 `loading="lazy"`를 붙이면 레이아웃이 계산될 때까지 요청이 미뤄져 오히려 LCP가 나빠진다. 첫 화면의 핵심 이미지는 반대로 우선순위를 높인다.

```html
<img src="hero.webp" fetchpriority="high" alt="서비스 메인 배너" width="1600" height="900" />
```

### JavaScript로 직접 구현하기

`loading="lazy"`로 부족할 때, 예를 들어 미리 불러올 거리를 직접 정하고 싶다면 `IntersectionObserver`를 쓴다. 실제 주소는 `data-src`에 두고, 요소가 뷰포트에 가까워졌을 때 `src`로 옮긴다.

```html
<img data-src="photo.jpg" alt="해 질 녘의 한강 공원" width="1200" height="800" class="lazy" />
```

```js
const observer = new IntersectionObserver(
  (entries, obs) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const img = entry.target;
      img.src = img.dataset.src;
      obs.unobserve(img);
    }
  },
  { rootMargin: '200px 0px' }, // 뷰포트 200px 전부터 미리 불러온다
);

document.querySelectorAll('img.lazy').forEach((img) => observer.observe(img));
```

`DOMContentLoaded`에서 모든 이미지의 `src`를 한꺼번에 채우는 방식은 지연 로딩이 아니다. 문서가 준비되자마자 모든 이미지를 요청하기 때문이다. 관찰자가 "보일 때"를 알려 주는 구조여야 한다. JavaScript가 꺼진 환경에서는 이미지가 보이지 않으므로, 가능하면 네이티브 `loading="lazy"`를 먼저 고려한다.

## CDN으로 전달하기

CDN(Content Delivery Network)은 사용자와 가까운 엣지 서버에 파일을 캐시해 두고 전달해 네트워크 지연을 줄인다. 이미지와 관련해서는 두 종류를 구분해 두면 좋다.

- **일반 CDN**: 이미 만들어 둔 파일을 캐시해 빠르게 전달한다. AWS CloudFront, Cloudflare CDN 등이 있다. 정적 호스팅 서비스도 대부분 CDN을 거쳐 파일을 제공한다.
- **이미지 CDN**: 원본 하나만 올려 두면 URL 파라미터나 요청 헤더에 따라 크기 조절, 포맷 변환, 압축을 즉석에서 해 준다. Cloudflare Images, Imgix 등이 있다. 앞에서 다룬 여러 크기·포맷의 파일을 직접 만들어 관리하지 않아도 된다.

어느 쪽이든 파일 이름에 해시를 넣고 긴 `Cache-Control` 기간을 주면 재방문 시 네트워크 요청 자체를 줄일 수 있다.

## 정리

- 사진은 AVIF·WebP를 기본으로, JPEG를 폴백으로 둔다. 아이콘과 로고는 SVG를 쓴다.
- `<picture>`로 포맷을, `srcset`과 `sizes`로 크기를 브라우저가 고르게 한다. `width`·`height`로 공간을 미리 확보해 레이아웃 이동을 막는다.
- sharp 같은 도구로 빌드 단계에서 변환과 압축을 자동화한다.
- 화면 밖 이미지는 `loading="lazy"`로 미루고, 첫 화면의 핵심 이미지는 `fetchpriority="high"`로 앞당긴다.
- CDN, 필요하면 이미지 CDN으로 전달 경로를 짧게 만든다.

## 참고

- [MDN 반응형 이미지](https://developer.mozilla.org/en-US/docs/Web/HTML/Responsive_images)
- [MDN img 요소](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/img)
- [MDN Intersection Observer API](https://developer.mozilla.org/en-US/docs/Web/API/Intersection_Observer_API)
- [web.dev Optimize Largest Contentful Paint](https://web.dev/articles/optimize-lcp)
- [sharp 문서](https://sharp.pixelplumbing.com/)
