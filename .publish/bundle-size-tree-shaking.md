
디바운스가 필요해서 한 줄을 추가했습니다.

```js
import { debounce } from 'lodash';
```

빌드 결과를 보니 번들이 눈에 띄게 커졌습니다.
함수 하나만 가져왔는데 왜 이럴까요.

반대로 이런 경험도 있습니다.
`import { format } from 'date-fns'`는 함수 하나 분량만 늘어납니다.
둘 다 "필요한 것만 이름으로 가져왔다"는 점에서 같아 보이는데 결과가 다릅니다.

이 차이를 이해하려면 번들러가 안 쓰는 코드를 어떻게 지우는지, 즉 **트리 셰이킹(tree shaking)** 이 어떻게 동작하는지 알아야 합니다.

## 트리 셰이킹은 "실행해 보지 않고" 판단합니다

번들러는 코드를 실행하지 않습니다.
소스 코드를 읽기만 해서 "이 함수는 어디서도 쓰이지 않는다"를 증명할 수 있어야 지울 수 있습니다.
그러려면 모듈 사이의 연결이 **코드를 읽는 것만으로 확정**되어야 합니다.

ES 모듈(ESM)의 `import`/`export`는 이 조건을 만족하도록 설계됐습니다.

- `import`와 `export`는 모듈 최상위에만 쓸 수 있습니다. `if` 안에서 조건부로 가져올 수 없습니다.
- 가져오는 이름은 문자열 리터럴로 고정되어 있습니다. 변수로 모듈 경로나 이름을 정할 수 없습니다.
- 내보낸 바인딩은 가져간 쪽에서 다시 할당할 수 없습니다.

그래서 번들러는 프로젝트의 모든 모듈을 읽고, 어떤 모듈의 어떤 `export`가 어디서 쓰이는지 그래프를 만들 수 있습니다.
그리고 아무도 쓰지 않는 `export`를 빼 버립니다.
Rollup이 이 방식을 대중화했고, 지금은 webpack, esbuild, Vite가 쓰는 번들러 모두 비슷한 일을 합니다.

번들러마다 세부 방식은 다릅니다.
webpack은 프로덕션 모드에서 쓰지 않는 `export`를 표시해 두고, 실제로 코드를 지우는 일은 마지막의 압축기(Terser 등)가 맡습니다.
그래서 개발 모드 빌드를 보고 "트리 셰이킹이 안 된다"고 판단하면 안 됩니다. 확인은 항상 프로덕션 빌드로 합니다.

## CommonJS는 왜 안 될까

`require`와 `module.exports`를 쓰는 CommonJS는 사정이 다릅니다.

```js
// CommonJS에서는 이런 코드가 전부 합법이다
const name = isServer ? './server' : './client';
const mod = require(name);

module.exports[`get${type}`] = () => { /* ... */ };

if (legacy) {
  module.exports = require('./legacy');
}
```

`require`는 그냥 함수 호출이라 어디서든, 어떤 값으로든 부를 수 있습니다.
`module.exports`는 평범한 객체라 실행 중에 무엇이든 붙이고 바꿀 수 있습니다.
코드를 실행해 보기 전에는 무엇이 내보내지는지 확정할 수 없습니다.

번들러 입장에서 안전한 선택은 하나뿐입니다. **모듈을 통째로 넣는 것**입니다.
`lodash` 패키지는 CommonJS로 배포되기 때문에 `{ debounce }`만 가져와도 사실상 라이브러리 전체가 들어옵니다.
처음의 의문이 이것으로 풀립니다.

webpack 5처럼 단순한 CommonJS 패턴은 일부 분석하는 번들러도 있지만, 범위가 제한적이라 기대지 않는 편이 좋습니다.

## sideEffects 필드

ESM이라고 다 지울 수 있는 것도 아닙니다.
어떤 모듈은 `export`를 아무도 쓰지 않아도, **가져오는 것만으로 무언가를 하기 때문**입니다.

```js
// polyfill.js
Array.prototype.last = function () {
  return this[this.length - 1];
};

// styles.js
import './button.css';
```

이런 일을 부수 효과(side effect)라고 합니다.
번들러는 어떤 모듈에 부수 효과가 있는지 완벽히 알 수 없으니, 확신이 없으면 남겨 둡니다.

라이브러리 작성자는 `package.json`의 `sideEffects` 필드로 이 판단을 도와줄 수 있습니다.

```json
{
  "name": "my-ui-kit",
  "sideEffects": false
}
```

`false`는 "이 패키지의 모든 모듈은 가져오기만 해서는 아무 일도 하지 않는다"는 선언입니다.
번들러는 이걸 믿고, 쓰지 않는 `export`만 있는 모듈을 파일째 건너뜁니다.

여기에 흔한 사고가 있습니다.
CSS를 `import`하는 패키지에서 `sideEffects: false`를 선언하면, CSS 파일도 "쓰는 것이 없는 모듈"로 보고 빠져 버립니다.
빌드하니 스타일이 사라졌다는 증상이 이것입니다.
부수 효과가 있는 파일은 배열로 따로 적습니다.

```json
{
  "sideEffects": ["*.css", "./src/polyfills.js"]
}
```

이 필드는 약속입니다.
틀린 약속을 하면 번들러는 그대로 믿고 필요한 코드를 지웁니다.

함수 호출 결과를 최상위에 저장하는 코드도 번들러가 지우기 망설이는 대상입니다.
`export const theme = createTheme({...})`는 `createTheme`이 무슨 일을 할지 모르니 남겨 두게 됩니다.
그래서 라이브러리들은 빌드 결과물에 `/*#__PURE__*/` 주석을 붙입니다. "이 호출은 결과를 쓰지 않으면 지워도 된다"는 표시입니다.

## 배럴 파일의 함정

프로젝트 안에서도 비슷한 일이 생깁니다.
폴더마다 `index.ts`를 두고 모든 것을 다시 내보내는 패턴, 이른바 배럴(barrel) 파일입니다.

```ts
// components/index.ts
export * from './Button';
export * from './Modal';
export * from './DataGrid';   // 무거운 표 라이브러리를 쓴다
export * from './Chart';      // 차트 라이브러리를 쓴다
```

```ts
import { Button } from '@/components';
```

가져오는 쪽은 깔끔해집니다.
그런데 `Button` 하나를 쓰려고 해도 번들러는 `index.ts`를 따라 `DataGrid`와 `Chart` 모듈까지 읽어야 합니다.
그 모듈들이 부수 효과가 없다고 증명되면 지워지지만, 최상위에서 무언가를 등록하거나 CSS를 가져오거나 `sideEffects` 정보가 없는 패키지를 쓰면 남습니다.

번들 크기만의 문제도 아닙니다.

- 개발 서버가 모듈 하나를 위해 수십, 수백 개 파일을 읽고 변환합니다. Vite처럼 개발 중에 모듈을 개별로 제공하는 도구에서는 첫 로딩이 눈에 띄게 느려질 수 있습니다.
- 테스트 러너도 테스트 하나를 위해 배럴 뒤의 모든 모듈을 불러옵니다.
- 모듈끼리 배럴을 통해 서로를 가져오면 순환 참조가 생기기 쉽습니다.

대책은 단순합니다.
앱 코드에서는 배럴 대신 실제 파일 경로로 가져오는 것입니다.

```ts
import { Button } from '@/components/Button';
```

배럴이 꼭 필요한 공개 라이브러리라면, 각 모듈에 부수 효과가 없도록 만들고 `sideEffects`를 정확하게 적습니다.
Next.js의 `optimizePackageImports`처럼 배럴 import를 빌드 시점에 개별 경로로 바꿔 주는 설정도 있으니, 쓰는 프레임워크의 문서를 확인해 보세요.

## lodash와 lodash-es

다시 처음의 `debounce`로 돌아갑니다.
선택지는 이렇습니다.

```js
// 1. CommonJS 패키지에서 이름으로: 전체가 들어온다
import { debounce } from 'lodash';

// 2. CommonJS 패키지에서 파일 경로로: 그 함수와 의존하는 내부 함수만
import debounce from 'lodash/debounce';

// 3. ESM 패키지에서 이름으로: 트리 셰이킹된다
import { debounce } from 'lodash-es';
```

`lodash-es`는 같은 코드를 ES 모듈로 배포한 패키지입니다.
번들러를 쓰는 프론트엔드 프로젝트라면 대개 3번이 가장 자연스럽습니다.
2번도 크기는 작지만, 코드 곳곳에 경로 import가 흩어지고 1번과 섞이기 쉽습니다.

더 근본적인 질문도 해 볼 만합니다.
`debounce` 정도는 몇 줄이면 직접 쓸 수 있고, `Array.prototype.flat`, `structuredClone`, `Object.groupBy`처럼 예전에 유틸 라이브러리가 하던 일을 지금은 표준 API가 하는 경우가 많습니다. 지원 브라우저는 MDN에서 확인하세요.

라이브러리 API 설계도 트리 셰이킹에 영향을 줍니다.
`moment().add(1, 'day').format()`처럼 **메서드 체이닝**으로 쓰는 라이브러리는 모든 기능이 한 객체(클래스)에 붙어 있습니다.
번들러는 클래스의 어떤 메서드가 쓰이는지 정적으로 알기 어려워서, 보통 클래스를 통째로 남깁니다.
`date-fns`처럼 **함수를 하나씩 가져다 쓰는** 라이브러리가 트리 셰이킹에 유리한 이유입니다.

## 번들을 직접 들여다보기

추측보다 확인이 먼저입니다.
번들 분석 도구는 빌드 결과에서 어떤 모듈이 얼마나 차지하는지 트리맵으로 보여 줍니다.

Vite나 Rollup이라면 `rollup-plugin-visualizer`를 씁니다.

```bash
npm install -D rollup-plugin-visualizer
```

```ts
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig({
  plugins: [
    react(),
    visualizer({
      filename: 'stats.html',
      gzipSize: true,
      open: true,
    }),
  ],
});
```

`npm run build`를 하면 `stats.html`이 만들어지고 브라우저로 열립니다.
webpack에는 `webpack-bundle-analyzer`, Next.js에는 `@next/bundle-analyzer`가 같은 역할을 합니다.
소스맵만 있으면 쓸 수 있는 `source-map-explorer`도 있습니다.

트리맵에서 보면 좋은 것들입니다.

- 생각보다 큰 사각형: 대개 통째로 들어온 CommonJS 라이브러리입니다.
- 같은 라이브러리가 두 번: 버전이 달라서 두 벌이 들어온 경우입니다. `npm ls <패키지>`로 누가 어떤 버전을 쓰는지 확인합니다.
- 쓴 적 없는 이름: 배럴 파일이나 의존성의 의존성을 따라 들어온 것입니다.
- 첫 화면에 필요 없는 큰 모듈: 다음에 다룰 코드 분할 후보입니다.

압축 전 크기만 보지 말고 gzip이나 brotli 크기도 함께 봅니다.
사용자가 실제로 내려받는 것은 압축된 크기이고, 브라우저가 파싱하고 실행하는 것은 압축 전 크기입니다. 둘 다 의미가 있습니다.

## 동적 import로 나중에 불러오기

트리 셰이킹은 "안 쓰는 코드"를 지웁니다.
하지만 **쓰는 코드인데 지금 당장은 필요 없는** 것도 있습니다.
설정 화면에서만 쓰는 차트, 내보내기 버튼을 눌러야 쓰는 엑셀 라이브러리 같은 것입니다.

이런 코드는 동적 `import()`로 분리합니다.

```js
exportButton.addEventListener('click', async () => {
  // 엑셀 라이브러리를 쓰는 무거운 모듈을 클릭했을 때만 불러온다
  const { exportToExcel } = await import('./exportToExcel');
  await exportToExcel(rows, 'report.xlsx');
});
```

`import()`는 Promise를 돌려주는 함수 형태의 import입니다.
번들러는 이걸 보고 해당 모듈을 별도 파일(청크)로 나누고, 이 코드가 실행될 때 내려받게 합니다.
첫 화면의 번들에서는 빠집니다.

React에서는 `lazy`와 `Suspense`로 컴포넌트 단위로 나눕니다.

```jsx
import { lazy, Suspense } from 'react';

const ReportChart = lazy(() => import('./ReportChart'));

function ReportPage() {
  return (
    <Suspense fallback={<p>차트를 불러오는 중입니다</p>}>
      <ReportChart />
    </Suspense>
  );
}
```

`lazy`는 기본 내보내기(default export)가 있는 모듈을 기대합니다.
이름 있는 내보내기만 있다면 `import('./ReportChart').then((m) => ({ default: m.ReportChart }))`처럼 감싸 줍니다.

나눈다고 공짜는 아닙니다.
필요한 순간에 네트워크 요청이 하나 더 생기니, 버튼을 누르고 기다리는 시간이 생깁니다.
마우스를 올렸을 때 미리 `import()`를 불러 두는 식으로 체감 지연을 줄일 수 있습니다.
너무 잘게 나누면 요청만 늘어나니, 분석 도구에서 큰 덩어리부터 나누는 것이 순서입니다.

## 정리

- 트리 셰이킹은 코드를 실행하지 않고 읽기만 해서 안 쓰는 `export`를 지웁니다. 그래서 정적으로 분석되는 ES 모듈이 필요합니다.
- CommonJS는 실행 전까지 무엇을 내보내는지 알 수 없어서 대개 통째로 들어옵니다. `lodash` 대신 `lodash-es`를 쓰는 이유입니다.
- 가져오기만 해도 무언가를 하는 모듈은 지워지지 않습니다. `sideEffects` 필드는 그 판단을 돕지만, CSS 같은 파일을 빠뜨리면 필요한 코드가 사라집니다.
- 배럴 파일은 번들과 개발 서버, 테스트를 모두 무겁게 만들 수 있습니다. 앱 코드에서는 실제 경로로 가져오세요.
- 추측하지 말고 번들 분석 도구로 확인합니다. 확인은 항상 프로덕션 빌드로 합니다.
- 지금 필요 없는 큰 코드는 동적 `import()`와 `React.lazy`로 나중에 불러옵니다.

## 참고

- [MDN - Tree shaking](https://developer.mozilla.org/en-US/docs/Glossary/Tree_shaking)
- [MDN - import()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/import)
- [webpack - Tree Shaking](https://webpack.js.org/guides/tree-shaking/)
- [React - lazy](https://react.dev/reference/react/lazy)
- [rollup-plugin-visualizer (npm)](https://www.npmjs.com/package/rollup-plugin-visualizer)
