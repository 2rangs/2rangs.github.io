import { createClient } from '@supabase/supabase-js'

// 브라우저에 공개되는 anon 키다. 쓰기 권한은 Supabase의 RLS 정책으로 막는다.
const url = import.meta.env.VITE_SUPABASE_URL || 'https://wbtbmarooytomtynuvoe.supabase.co'
const key = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndidGJtYXJvb3l0b210eW51dm9lIiwicm9sZSI6ImFub24iLCJpYXQiOjE2OTg2NTQ3NTAsImV4cCI6MjAxNDIzMDc1MH0.xV176B7fRp8qooWmygkUmGxA4shPEjH7JGXNrsx3QEk'

export const supabase = createClient(url, key)
