
React로 만든 사이트를 깃허브 페이지에 올렸습니다. 첫 화면도 잘 뜨고, 메뉴를 눌러 `/about`으로 가는 것도 잘 됩니다.

그런데 `/about`에서 새로고침을 누르면 404가 뜹니다. 주소를 복사해서 친구에게 보내도 404고요. 방금까지 잘 보이던 페이지인데 말이죠.

이건 React나 깃허브 페이지의 버그가 아닙니다. 페이지를 누가 찾아 주는지가 상황에 따라 달라서 생기는 일이에요.

## 두 가지 길 찾기

깃허브 공식 문서는 깃허브 페이지를 정적 사이트 호스팅 서비스라고 소개합니다. 저장소에 있는 HTML, CSS, 자바스크립트 파일을 그대로 보여 주는 곳이고, 주소를 파일 경로로 바꿔서 찾습니다.

```text
/             → index.html
/about/       → about/index.html
/style.css    → style.css
```

그런데 React 앱을 빌드하면 보통 HTML 파일이 하나뿐입니다. `index.html` 하나에 자바스크립트가 붙어 있고, 화면 전환은 브라우저 안에서 라우터가 처리해요.

메뉴를 눌러 이동할 때는 서버에 묻지 않습니다. 라우터가 History API의 `pushState()`로 주소만 바꾸고 화면을 다시 그리니까 잘 됩니다.

새로고침은 다릅니다. 브라우저가 서버에 `/about`을 달라고 다시 요청하고, 서버는 `about/index.html`을 찾지만 그런 파일은 없으니 404를 돌려줍니다. 앱 안에서 이동할 때는 브라우저의 라우터가, 새로고침이나 직접 접속은 서버가 길을 찾는데, 둘이 아는 지도가 다른 거죠.

일반 서버라면 "모르는 주소는 전부 `index.html`을 줘"라고 설정하면 끝납니다. 깃허브 페이지는 그런 설정을 할 수 없으니 다른 방법을 써야 해요.

## 404.html 트릭

깃허브 공식 문서에 따르면 저장소 게시 경로 맨 위에 `404.html`을 두면, 없는 주소로 들어왔을 때 그 페이지를 보여 줍니다.

그럼 `404.html`을 `index.html`과 똑같이 만들면 어떨까요? 없는 주소로 와도 결국 같은 앱이 뜨고, 라우터가 주소를 보고 알맞은 화면을 그립니다.

```bash
npm run build
cp dist/index.html dist/404.html
```

`package.json`의 빌드 스크립트에 붙여 두면 잊어버릴 일이 없습니다.

```json
{
  "scripts": {
    "build": "vite build && cp dist/index.html dist/404.html"
  }
}
```

가장 간단하지만 단점이 분명합니다. 화면은 잘 뜨지만 응답 상태 코드는 여전히 404입니다. 직접 `curl`로 확인해 봐도 404가 찍혀요.

사람 눈에는 문제없어 보여도 검색 엔진이나 링크 미리보기 도구는 "없는 페이지"로 받아들일 수 있습니다. 개인 도구나 관리자 화면이라면 괜찮지만, 검색에 노출돼야 하는 블로그라면 아쉽습니다.

하나 더, 저장소 이름이 들어가는 프로젝트 사이트(`<owner>.github.io/<repo>/`)라면 Vite의 `base`를 `'/<repo>/'`로 맞춰야 한다고 Vite 문서에 나와 있습니다. 라우터에도 같은 `basename`을 주지 않으면 경로가 하나씩 어긋납니다.

## 해시 라우터

두 번째 방법은 경로를 `#` 뒤로 옮기는 겁니다.

```text
https://example.github.io/#/about
```

`#` 뒤쪽은 서버로 보내지 않습니다. 서버는 늘 `/`만 요청받으니 항상 `index.html`을 주고, 라우터가 `#/about`을 읽어 화면을 그립니다. 새로고침해도 404가 날 수가 없어요.

React Router에서는 `createHashRouter`를 쓰면 됩니다.

```tsx
import { createHashRouter, RouterProvider } from "react-router";
import Home from "./pages/Home";
import About from "./pages/About";

const router = createHashRouter([
  { path: "/", element: <Home /> },
  { path: "/about", element: <About /> },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
```

설정은 제일 쉽지만 주소가 조금 어색합니다. 그리고 `#` 자리를 라우터가 차지하니, 글 안 제목으로 이동하는 `#설치-방법` 같은 링크와 부딪힙니다.

## 빌드할 때 페이지를 미리 만들기

세 번째는 서버의 지도에 맞춰 주는 방법입니다. 서버가 `about/index.html`을 찾는다면 그 파일을 실제로 만들어 두면 됩니다.

빌드가 끝난 뒤 라우트마다 HTML을 하나씩 만드는 걸 프리렌더라고 부릅니다.

```text
dist/
  index.html
  about/index.html
  posts/hello-world/index.html
  404.html
```

이제 `/about/`으로 들어오면 진짜 파일이 있으니 200으로 응답합니다. 제 블로그에서 확인해 보니 끝에 `/`가 없는 `/blog`로 들어와도 깃허브 페이지가 `/blog/`로 301 리다이렉트해 주더라고요.

미리 만든 HTML에 글 제목과 본문까지 들어 있으면 좋은 점이 더 있습니다. 자바스크립트가 뜨기 전에도 내용이 보이고, 링크 미리보기에도 제목이 제대로 나옵니다.

대신 할 일이 늘어납니다. 빌드 때 어떤 라우트가 있는지 알아야 해서, 글 목록을 API로 받는다면 빌드 스크립트에서도 받아 와야 해요. 새 글을 쓰면 다시 빌드하고 배포해야 페이지가 생기고, 미리 만든 HTML과 앱이 그린 화면이 다르면 깜빡임이 생길 수 있습니다.

그리고 정말 없는 주소를 위해 `404.html`은 여전히 둡니다. 이번에는 앱 복사본이 아니라 진짜 "페이지를 찾을 수 없어요" 화면으로요.

## 무엇을 고를까

빨리 띄워 보는 개인 프로젝트라면 404.html 복사로 충분합니다. 주소 모양이 상관없고 설정을 최소로 하고 싶다면 해시 라우터, 검색에 노출돼야 하는 블로그나 문서라면 프리렌더가 맞습니다.

새로고침 404는 "앱은 주소를 아는데 서버는 모른다"는 신호입니다. 서버에게 알려 주거나, 서버가 몰라도 되게 하거나, 둘 중 하나를 고르면 됩니다.

## 참고

- [What is GitHub Pages? | GitHub Docs](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)
- [Creating a custom 404 page for your GitHub Pages site | GitHub Docs](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-custom-404-page-for-your-github-pages-site)
- [History API | MDN](https://developer.mozilla.org/en-US/docs/Web/API/History_API)
- [URI fragment | MDN](https://developer.mozilla.org/en-US/docs/Web/URI/Reference/Fragment)
- [createHashRouter | React Router](https://reactrouter.com/api/data-routers/createHashRouter)
- [Deploying a Static Site, GitHub Pages | Vite](https://vite.dev/guide/static-deploy)
