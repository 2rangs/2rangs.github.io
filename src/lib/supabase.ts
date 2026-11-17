import { createClient } from '@supabase/supabase-js'

// 브라우저에 공개되는 anon 키다. 쓰기 권한은 Supabase의 RLS 정책으로 막는다.
const url = import.meta.env.VITE_SUPABASE_URL || 'https://wbtbmarooytomtynuvoe.supabase.co'
const key = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndidGJtYXJvb3l0b210eW51dm9lIiwicm9sZSI6ImFub24iLCJpYXQiOjE2OTg2NTQ3NTAsImV4cCI6MjAxNDIzMDc1MH0.xV176B7fRp8qooWmygkUmGxA4shPEjH7JGXNrsx3QEk'

// GitHub 로그인이 실패하면 Supabase가 주소 뒤에 #error_description=...을 붙여 돌려보낸다.
// 클라이언트가 만들어지면서 그 부분을 지우므로, 만들기 전에 읽어 둔다(글쓰기 로그인 화면이 보여 준다).
function readRedirectError() {
  if (typeof location === 'undefined') return ''
  const params = new URLSearchParams(location.hash.replace(/^#/, '') || location.search)
  return params.get('error_description') || params.get('error') || ''
}
export const authRedirectError = readRedirectError()

export const supabase = createClient(url, key)
