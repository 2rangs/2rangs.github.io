// 서명(public/img/signature.png)의 앞부분(J와 가로획)을 잘라 사이트 아이콘을 만든다.
// 서명 선이 가늘어서 작은 크기에서는 획을 두껍게(feMorphology dilate) 한다.
//   node scripts/icons.mjs
// 만드는 파일
//   public/favicon.svg          브라우저 탭 (차콜 바탕 + 은색 마크)
//   public/favicon-32.png       SVG 파비콘을 못 쓰는 브라우저용
//   public/apple-touch-icon.png 홈 화면 아이콘 (180)
//   public/icon-512.png         큰 아이콘 (웹 앱, 검색 결과 등)
//   public/img/mark.svg         배경 없는 흰 마크. CSS mask로 글자색·은박을 입힌다.
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

const SILVER = `<linearGradient id="silver" x1="0" y1="0" x2="1" y2="1">
  <stop offset="0" stop-color="#9aa1a8"/><stop offset="0.45" stop-color="#eef1f3"/><stop offset="0.6" stop-color="#c3c8cd"/><stop offset="1" stop-color="#8a9096"/>
</linearGradient>`

function appIcon({ size, bold, radius }) {
  const mark = markLayer({ size, inset: size * 0.16, bold, fill: 'url(#silver)' })
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
<defs>
${SILVER}
<linearGradient id="paper" x1="0" y1="0" x2="0.4" y2="1"><stop offset="0" stop-color="#2a2927"/><stop offset="1" stop-color="#161615"/></linearGradient>
${mark.defs}
</defs>
<rect width="${size}" height="${size}" rx="${radius}" fill="url(#paper)"/>
${mark.body}
</svg>`
}

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

// 탭 아이콘은 16~32px로 보이므로 획을 많이 키운다. 큰 아이콘은 조금만.
const tab = appIcon({ size: 64, bold: 9, radius: 14 })
const large = appIcon({ size: 512, bold: 4, radius: 0 })
await writeFile(join(root, 'public/favicon.svg'), tab)
await writeFile(join(root, 'public/favicon-32.png'), png(tab, 32))
await writeFile(join(root, 'public/apple-touch-icon.png'), png(large, 180))
await writeFile(join(root, 'public/icon-512.png'), png(large, 512))
await writeFile(join(root, 'public/img/mark.svg'), plainMark({ size: 96, bold: 5 }))
console.log('아이콘을 만들었습니다: favicon.svg, favicon-32.png, apple-touch-icon.png, icon-512.png, img/mark.svg')
