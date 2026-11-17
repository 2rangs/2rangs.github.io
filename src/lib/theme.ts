// 밝은/어두운 테마. 고르지 않았으면 시스템 설정을 따르고, 고른 값은 이 브라우저에만 저장한다.
// 첫 화면 깜빡임을 막으려고 index.html의 짧은 스크립트가 같은 키를 읽어 그리기 전에 적용한다.
export type Theme = 'light' | 'dark'
const KEY = 'theme'
export const THEME_EVENT = 'themechange'

export function savedTheme(): Theme | null {
  try {
    const value = localStorage.getItem(KEY)
    return value === 'light' || value === 'dark' ? value : null
  } catch {
    return null
  }
}

export const currentTheme = (): Theme =>
  savedTheme() ?? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')

export function setTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme
  try {
    localStorage.setItem(KEY, theme)
  } catch {
    // 저장하지 못해도 이번 화면에는 적용된다.
  }
  window.dispatchEvent(new CustomEvent(THEME_EVENT, { detail: theme }))
}
