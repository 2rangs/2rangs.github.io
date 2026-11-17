import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 2rangs.github.io 루트에 배포한다. 페이지별 HTML은 빌드 뒤 scripts/prerender.mjs가 만든다.
export default defineConfig({
  base: '/',
  plugins: [react()],
})
