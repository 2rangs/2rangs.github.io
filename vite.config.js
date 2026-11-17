import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

// 페이지마다 실제 HTML 파일을 만들어 GitHub Pages에서 주소가 그대로 열리게 한다.
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        home: resolve(import.meta.dirname, 'index.html'),
        projects: resolve(import.meta.dirname, 'projects/index.html'),
        blog: resolve(import.meta.dirname, 'blog/index.html'),
        write: resolve(import.meta.dirname, 'write/index.html'),
      },
    },
  },
})
