// 사이트 아이콘을 만든다.
//   node scripts/icons.mjs
// 만드는 파일
//   public/favicon.svg          브라우저 탭 (둥근 육각형 + 물결 두 줄, 배경 없음)
//   public/favicon-32.png       SVG 파비콘을 못 쓰는 브라우저용
//   public/apple-touch-icon.png 홈 화면 아이콘 (180, 흰 바탕)
//   public/icon-512.png         큰 아이콘 (웹 앱, 검색 결과 등, 흰 바탕)
//   public/img/mark.svg         헤더·푸터·링크 미리보기 마크 (같은 육각형, 흰색 + 뚫린 선). 예전 서명 마크(plainMark)는 코드만 남겨 둔다.
//                               서명 마크는 public/img/signature.png 앞부분을 잘라 만들고, 작은 크기에서는 획을 두껍게(feMorphology dilate) 한다.
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { Resvg } from '@resvg/resvg-js'

const root = join(import.meta.dirname, '..')
const signature = (await readFile(join(root, 'public/img/signature.png'))).toString('base64')

// signature.png는 490x197. 앞쪽 214px을 마크로 쓰고, 오른쪽 끝은 획이 잘린 티가 나지 않게 흐리게 사라지게 한다.
const SRC_W = 490
const SRC_H = 197
const MARK_W = 214

// size 칸 안에 마크를 inset만큼 띄워 그린다. bold는 원본 픽셀 기준 획을 넓힐 반지름.
function markLayer({ size, inset, bold, fill }) {
  const box = size - inset * 2
  const scale = box / MARK_W
  const w = SRC_W * scale
  const h = SRC_H * scale
  const x = inset
  const y = (size - h) / 2
  const id = `m${size}${bold}`
  return {
    defs: `<filter id="${id}w" x="-10%" y="-10%" width="120%" height="120%" color-interpolation-filters="sRGB">
  <feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 1 0"/>
  <feMorphology operator="dilate" radius="${(bold * scale).toFixed(3)}"/>
</filter>
<linearGradient id="${id}g" gradientUnits="userSpaceOnUse" x1="${x + box * 0.6}" y1="0" x2="${x + box}" y2="0"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#000"/></linearGradient>
<mask id="${id}f" maskUnits="userSpaceOnUse" x="0" y="0" width="${size}" height="${size}"><rect width="${size}" height="${size}" fill="url(#${id}g)"/></mask>
<mask id="${id}" maskUnits="userSpaceOnUse" x="0" y="0" width="${size}" height="${size}">
  <g mask="url(#${id}f)"><image x="${x}" y="${y.toFixed(2)}" width="${w.toFixed(2)}" height="${h.toFixed(2)}" filter="url(#${id}w)" href="data:image/png;base64,${signature}"/></g>
</mask>`,
    body: `<rect width="${size}" height="${size}" fill="${fill}" mask="url(#${id})"/>`,
  }
}

// 둥근 육각형(꼭짓점이 위아래) 안에 흰 육각형 테두리와 물결 두 줄. 512 격자에서 그리고 viewBox로 줄인다.
// 작은 크기에서는 흰 선이 뭉개지지 않게 선을 굵게(ring, wave) 한다.
const hexagon = (r) => Array.from({ length: 6 }, (_, i) => {
  const a = (Math.PI / 3) * i - Math.PI / 2
  return `${(256 + r * Math.cos(a)).toFixed(1)},${(256 + r * Math.sin(a)).toFixed(1)}`
}).join(' ')

// 꼭짓점을 corner만큼 깎아 둥글린 육각형 경로.
function roundedHexagon(r, corner) {
  const points = hexagon(r).split(' ').map((pair) => pair.split(',').map(Number))
  const toward = ([ax, ay], [bx, by]) => {
    const length = Math.hypot(bx - ax, by - ay)
    return [ax + ((bx - ax) * corner) / length, ay + ((by - ay) * corner) / length]
  }
  const f = (n) => n.toFixed(1)
  return points.map((point, i) => {
    const before = toward(point, points[(i + 5) % 6])
    const after = toward(point, points[(i + 1) % 6])
    return `${i ? 'L' : 'M'}${f(before[0])} ${f(before[1])} Q${f(point[0])} ${f(point[1])} ${f(after[0])} ${f(after[1])}`
  }).join(' ') + ' Z'
}

function hexIcon({ size, ring, wave, background }) {
  const waves = [226, 296].map((y) => `<path d="M156 ${y - 10} q17 20 34 0 t34 0 t34 0 t34 0 t34 0 t34 0" fill="none" stroke="#ffffff" stroke-width="${wave}" stroke-linecap="round" stroke-linejoin="round"/>`).join('\n')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
${background ? `<rect width="512" height="512" fill="${background}"/>` : ''}
<g transform="translate(256 256) scale(${background ? 0.82 : 1}) translate(-256 -256)">
<polygon points="${hexagon(212)}" fill="#111111" stroke="#111111" stroke-width="80" stroke-linejoin="round"/>
<path d="${roundedHexagon(180, 34)}" fill="none" stroke="#ffffff" stroke-width="${ring}" stroke-linejoin="round"/>
${waves}
</g>
</svg>`
}

// 헤더·푸터와 링크 미리보기에 쓰는 마크: 흰 육각형에서 테두리와 물결을 뚫어 낸 모양.
// CSS mask와 SVG mask로 색을 입히므로 흰색과 투명만 쓴다.
function hexMark({ size, ring, wave }) {
  const waves = [226, 296].map((y) => `<path d="M156 ${y - 10} q17 20 34 0 t34 0 t34 0 t34 0 t34 0 t34 0" fill="none" stroke="#000000" stroke-width="${wave}" stroke-linecap="round" stroke-linejoin="round"/>`).join('\n')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
<defs>
<mask id="cut" maskUnits="userSpaceOnUse" x="0" y="0" width="512" height="512">
<rect width="512" height="512" fill="#ffffff"/>
<path d="${roundedHexagon(180, 34)}" fill="none" stroke="#000000" stroke-width="${ring}" stroke-linejoin="round"/>
${waves}
</mask>
</defs>
<polygon points="${hexagon(212)}" fill="#ffffff" stroke="#ffffff" stroke-width="80" stroke-linejoin="round" mask="url(#cut)"/>
</svg>`
}

// 예전 서명 마크. 다시 쓸 때를 위해 남겨 둔다.
function plainMark({ size, bold }) {
  const mark = markLayer({ size, inset: 0, bold, fill: '#ffffff' })
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
<defs>
${mark.defs}
</defs>
${mark.body}
</svg>`
}

const png = (svg, width) => new Resvg(svg, { fitTo: { mode: 'width', value: width } }).render().asPng()

// 탭 아이콘은 16~32px로 보이므로 흰 선을 굵게 한다. 큰 아이콘은 원래 굵기.
const tab = hexIcon({ size: 64, ring: 30, wave: 30 })
const large = hexIcon({ size: 512, ring: 16, wave: 14, background: '#ffffff' })
await writeFile(join(root, 'public/favicon.svg'), tab)
await writeFile(join(root, 'public/favicon-32.png'), png(tab, 32))
await writeFile(join(root, 'public/apple-touch-icon.png'), png(large, 180))
await writeFile(join(root, 'public/icon-512.png'), png(large, 512))
await writeFile(join(root, 'public/img/mark.svg'), hexMark({ size: 96, ring: 34, wave: 34 }))
console.log('아이콘을 만들었습니다: favicon.svg, favicon-32.png, apple-touch-icon.png, icon-512.png, img/mark.svg')
