import thumbs from './thumbs.json'

// 대표 이미지(public/img/covers, public/img/projects의 PNG)에 작은 WebP 버전(scripts/thumbs.mjs)을 이어 붙인다.
// 브라우저는 sizes에 맞는 크기를 골라 받는다. WebP가 없는 이미지(외부 주소 등)는 원본만 쓴다.
const available = new Set<string>(thumbs)

export function coverImage(src: string, sizes: string): { src: string; srcSet?: string; sizes?: string } {
  const match = /\/img\/(covers|projects)\/([^/?#]+)\.png$/.exec(src)
  if (!match || !available.has(`${match[1]}/${match[2]}`)) return { src }
  const base = `/img/thumbs/${match[1]}-${match[2]}`
  return { src, srcSet: `${base}-320.webp 320w, ${base}-600.webp 600w, ${base}-1200.webp 1200w`, sizes }
}
