import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Pretendard는 font-display: swap으로 배포된다. 미리 그린 HTML이 먼저 보이는 지금은
// 글꼴이 늦게 도착해 바뀌는 순간 글자 폭과 줄바꿈이 달라지며 화면 전체가 밀린다(CLS).
// optional로 바꿔, 첫 순간에 준비되지 않았으면 그 페이지는 대체 글꼴로 두고 다음 페이지부터 쓴다.
function fontDisplayOptional() {
  return {
    name: 'pretendard-font-display-optional',
    enforce: 'pre',
    transform(code, id) {
      if (!id.includes('pretendard') || !id.includes('.css')) return
      return code.replaceAll('font-display: swap', 'font-display: optional')
    },
  }
}

// 2rangs.github.io 루트에 배포한다. 페이지별 HTML은 빌드 뒤 scripts/prerender.mjs가 만든다.
export default defineConfig({
  base: '/',
  plugins: [fontDisplayOptional(), react()],
})
