// 글 본문에 넣는 밈 이미지를 public/img/posts/<slug>/<이름>.webp 로 만든다.
//   node scripts/post-memes.mjs            전부
//   node scripts/post-memes.mjs <slug>...  고른 글만
// 밈 원본은 scripts/memes(imgflip 템플릿). 너비 900px(원본이 작으면 600px)로 키운 뒤 문구를 얹는다.
// top/bottom은 그림 위아래 끝의 흰 글씨 + 검은 테두리, text는 [x, y, 문구, 크기, 모양, 회전].
// x, y는 그림 안의 비율(0~1), 크기는 출력 그림 기준 px, 모양은 ink(검은 글씨) 또는 meme(흰 글씨 + 검은 테두리).
// cwebp가 필요하다(macOS: brew install webp).
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Resvg } from '@resvg/resvg-js'

const root = join(import.meta.dirname, '..')
const fonts = ['Bold', 'SemiBold', 'Medium'].map((weight) => join(root, `node_modules/pretendard/dist/public/static/Pretendard-${weight}.otf`))

const posts = {
  'foxtail-is-human-tail': [
    { name: '01-ancient-aliens', image: 'ancient-aliens.jpg', top: '꼬리가 그냥 사라졌다고요?', bottom: '강아지풀입니다' },
    { name: '02-scroll-of-truth', image: 'scroll-of-truth.jpg', text: [[0.225, 0.725, '강아지풀은\n벼과\n한해살이\n풀이다', 30, 'ink']] },
    { name: '03-same-picture', image: 'same-picture.jpg', text: [[0.27, 0.165, '강아지풀', 44, 'ink', -12], [0.74, 0.2, '인간의\n꼬리', 44, 'ink', -12]] },
    { name: '04-distracted-dog', image: 'distracted-boyfriend.jpg', text: [[0.3, 0.6, '강아지풀', 40, 'meme'], [0.6, 0.75, '실험견', 40, 'meme'], [0.83, 0.62, '고무 장난감\n(대조군)', 32, 'meme']] },
    { name: '05-expanding-brain', image: 'expanding-brain.jpg', text: [[0.24, 0.125, '꼬리는\n퇴화했다', 58, 'ink'], [0.24, 0.375, '꼬리뼈로\n남았다', 58, 'ink'], [0.24, 0.625, '몸에서\n떨어져 나갔다', 50, 'ink'], [0.24, 0.875, '땅에 뿌리내려\n광합성 중', 50, 'ink']] },
    { name: '06-bell-curve', image: 'bell-curve.png', text: [[0.13, 0.4, '강아지풀은\n꼬리다', 32, 'ink'], [0.87, 0.3, '강아지풀은\n꼬리다', 32, 'ink'], [0.74, 0.11, 'Setaria viridis는\nC4 벼과 식물이며\n척추동물 꼬리와의\n상동성은...', 22, 'ink']] },
    { name: '07-waiting-skeleton', image: 'waiting-skeleton.jpg', top: '꼬리가 다시 자라길', bottom: '관찰 30년째' },
  ],
  'do-you-know-this-chicken': [
    { name: '01-grus-plan', image: 'grus-plan.jpg', text: [[0.375, 0.25, '하숙방을\n빌린다', 36, 'ink'], [0.87, 0.25, '전자바지를\n개조한다', 32, 'ink'], [0.375, 0.76, '개가\n다 보고\n있었다', 34, 'ink'], [0.87, 0.76, '개가\n다 보고\n있었다', 34, 'ink']] },
    { name: '02-uno-draw-25', image: 'uno-draw-25.jpg', text: [[0.2, 0.45, '한 마디\n해명하기', 34, 'ink', -4], [0.72, 0.1, '페더스 맥그로', 40, 'meme']] },
    { name: '03-distracted-wallace', image: 'distracted-boyfriend.jpg', text: [[0.3, 0.6, '새 하숙인', 40, 'meme'], [0.6, 0.66, '월레스', 40, 'meme'], [0.83, 0.62, '그로밋', 40, 'meme']] },
    { name: '04-scooby-reveal', image: 'scooby-reveal.jpg', text: [[0.2, 0.4, '수배범: 닭', 48, 'meme'], [0.2, 0.9, '펭귄', 72, 'meme'], [0.72, 0.42, '그로밋', 44, 'meme']] },
    { name: '05-they-dont-know', image: 'they-dont-know.png', text: [[0.45, 0.16, '쟤들은 내가\n닭이 아니라는 걸\n모르겠지', 38, 'ink']] },
    { name: '06-panik-kalm', image: 'panik-kalm.png', text: [[0.24, 0.17, '다이아몬드\n도둑\n수배 중', 50, 'ink'], [0.24, 0.5, '범인은\n닭이래', 56, 'ink'], [0.24, 0.83, '우리 하숙인이\n고무장갑을\n쓰고 있다', 42, 'ink']] },
  ],
}

const xml = (value) => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// 글자 너비를 em 단위로 어림한다(Pretendard Bold 기준).
const em = (text) => [...text].reduce((sum, char) => sum + (char === ' ' ? 0.27 : /[ᄀ-￿]/.test(char) ? 0.9 : /[mwMW@]/.test(char) ? 0.9 : /[A-Z0-9]/.test(char) ? 0.66 : /[ilj.,:;'!|()]/.test(char) ? 0.32 : 0.56), 0)

function caption(x, y, text, size, style, rotate = 0) {
  const lines = text.split('\n')
  const gap = size * 1.18
  const first = y - ((lines.length - 1) * gap) / 2 + size * 0.36
  const spans = lines.map((line, index) => `<tspan x="${x}" y="${first + index * gap}">${xml(line)}</tspan>`).join('')
  const turn = rotate ? ` transform="rotate(${rotate} ${x} ${y})"` : ''
  const base = `font-size="${size}" font-weight="700" text-anchor="middle"${turn}`
  if (style === 'ink') return `<text ${base} fill="#111111">${spans}</text>`
  return `<text ${base} fill="none" stroke="#000000" stroke-width="${size * 0.22}" stroke-linejoin="round">${spans}</text><text ${base} fill="#ffffff">${spans}</text>`
}

function size(file) {
  const out = execFileSync('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', file], { encoding: 'utf8' })
  return [Number(out.match(/pixelWidth: (\d+)/)[1]), Number(out.match(/pixelHeight: (\d+)/)[1])]
}

function render({ image, top, bottom, text = [] }) {
  const file = join(root, 'scripts/memes', image)
  const [W, H] = size(file)
  const w = W >= 600 ? 900 : 600
  const h = Math.round((H * w) / W)
  const href = `data:image/${image.endsWith('.png') ? 'png' : 'jpeg'};base64,${readFileSync(file).toString('base64')}`
  const edge = (label, at) => {
    if (!label) return ''
    const px = Math.min(Math.round(w * 0.075), Math.floor((w - 48) / em(label)))
    return caption(w / 2, at === 'top' ? 18 + px * 0.5 : h - 18 - px * 0.5, label, px, 'meme')
  }
  const overlays = text.map(([fx, fy, label, px, style, rotate]) => caption(fx * w, fy * h, label, Math.round((px * w) / 900), style, rotate)).join('\n')
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" font-family="Pretendard">
<image width="${w}" height="${h}" preserveAspectRatio="none" xlink:href="${href}"/>
${edge(top, 'top')}
${edge(bottom, 'bottom')}
${overlays}
</svg>`
}

const only = process.argv.slice(2)
const temp = await mkdtemp(join(tmpdir(), 'post-memes-'))
let made = 0
for (const [slug, memes] of Object.entries(posts)) {
  if (only.length && !only.includes(slug)) continue
  const dir = join(root, 'public/img/posts', slug)
  await mkdir(dir, { recursive: true })
  for (const meme of memes) {
    const png = join(temp, `${slug}-${meme.name}.png`)
    await writeFile(png, new Resvg(render(meme), { font: { fontFiles: fonts, loadSystemFonts: false, defaultFontFamily: 'Pretendard' } }).render().asPng())
    execFileSync('cwebp', ['-quiet', '-q', '80', png, '-o', join(dir, `${meme.name}.webp`)])
    made += 1
  }
}
console.log(`본문 밈 ${made}개를 만들었습니다`)
