import { supabase } from './supabase'

// 이미지는 Supabase Storage의 공개 버킷에 올린다.
// 버킷이 없거나 권한이 없으면, 작은 이미지에 한해 예전 블로그처럼 본문에 직접 넣는다.
const BUCKET = 'blog-images'
const EMBED_LIMIT = 1_500_000

const toDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })

export async function uploadImage(file: File): Promise<{ url: string; embedded: boolean }> {
  if (!file.type.startsWith('image/')) throw new Error('이미지 파일만 넣을 수 있습니다.')
  const extension = (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '') || 'png'
  const path = `${new Date().toISOString().slice(0, 7)}/${crypto.randomUUID()}.${extension}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type, cacheControl: '31536000' })
  if (!error) return { url: supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl, embedded: false }
  if (file.size > EMBED_LIMIT) {
    throw new Error(`이미지를 올리지 못했습니다 (${error.message}). Supabase Storage에 공개 버킷 "${BUCKET}"과 업로드 권한이 필요합니다.`)
  }
  return { url: await toDataUrl(file), embedded: true }
}
