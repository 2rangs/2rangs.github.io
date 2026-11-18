// vite build 뒤에 실행한다. dist/index.html을 틀로 삼아 주소마다 완성된 HTML을 만들고,
// 링크 미리보기 썸네일(og 이미지), sitemap.xml, rss.xml, robots.txt, 404.html을 함께 만든다.
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { createServer } from 'vite'
import { Resvg } from '@resvg/resvg-js'

const root = join(import.meta.dirname, '..')
const dist = join(root, 'dist')
const fonts = ['Bold', 'Medium'].map((weight) => join(root, `node_modules/pretendard/dist/public/static/Pretendard-${weight}.otf`))

// src의 화면 코드를 그대로 불러 쓰기 위해 Vite로 모듈을 읽는다.
const vite = await createServer({ root, server: { middlewareMode: true }, appType: 'custom', logLevel: 'warn' })
const { buildPages } = await vite.ssrLoadModule('/src/prerender.tsx')
const { headHtml, absolute } = await vite.ssrLoadModule('/src/lib/seo.ts')
const { SITE } = await vite.ssrLoadModule('/src/lib/site.ts')
const { pages, posts, notFound } = await buildPages()
await vite.close()

// CSS 파일(압축 약 11KB)을 HTML 안에 넣어, 첫 화면이 CSS 요청을 한 번 더 기다리지 않게 한다.
const template = await inlineCss(await readFile(join(dist, 'index.html'), 'utf8'))

async function inlineCss(html) {
  const link = /<link rel="stylesheet"[^>]*href="(\/assets\/[^"]+\.css)"[^>]*>/.exec(html)
  if (!link) return deferScript(html)
  const css = await readFile(join(dist, link[1]), 'utf8')
  return deferScript(html.replace(link[0], () => `<style>${css.replace(/<\/style/gi, '<\\/style')}</style>`))
}

// 페이지는 미리 그린 HTML만으로 다 보인다. 앱 코드(hydrate)는 첫 화면이 그려진 다음에 받기 시작해,
// 느린 회선에서도 JS 다운로드가 첫 화면과 경쟁하지 않게 한다.
function deferScript(html) {
  const tag = /<script type="module" crossorigin src="(\/assets\/[^"]+\.js)"><\/script>/.exec(html)
  if (!tag) return html
  // 첫 화면이 실제로 그려진 것(first-contentful-paint)을 확인한 뒤 받는다. 그 신호가 없으면(숨은 탭 등) load 3초 뒤에 받는다.
  const loader = `<script>(function(){var d=0;function go(){if(d)return;d=1;var s=document.createElement('script');s.type='module';s.crossOrigin='anonymous';s.src=${JSON.stringify(tag[1])};document.head.appendChild(s)}function soon(){setTimeout(go,0)}try{new PerformanceObserver(function(l){if(l.getEntriesByName('first-contentful-paint').length)soon()}).observe({type:'paint',buffered:true})}catch(e){soon()}function late(){setTimeout(go,3000)}if(document.readyState==='complete')late();else addEventListener('load',late)})()</script>`
  return html.replace(tag[0], () => loader)
}
const xml = (value) => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function fill({ meta, html, data, path }) {
  const embedded = data ? `<script id="__DATA__" type="application/json">${JSON.stringify({ path, ...data }).replace(/</g, '\\u003c')}</script>` : ''
  return template.replace('<!--head-->', () => headHtml(meta)).replace('<!--app-->', () => html).replace('<!--data-->', () => embedded)
}

async function write(file, content) {
  await mkdir(dirname(file), { recursive: true })
  await writeFile(file, content)
}

// 글 제목이 들어간 1200x630 썸네일. 한글은 한 글자를 1칸, 영문·숫자는 0.56칸으로 어림해 줄을 나눈다.
const width = (text) => [...text].reduce((sum, char) => sum + (char === ' ' ? 0.3 : /[\u1100-\uffff]/.test(char) ? 1 : 0.56), 0)

function wrap(title, limit = 15, maxLines = 3) {
  const lines = []
  let line = ''
  for (const word of title.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word
    if (width(next) <= limit) {
      line = next
      continue
    }
    if (line) lines.push(line)
    line = word
    while (width(line) > limit) {
      let cut = line.length
      while (width(line.slice(0, cut)) > limit) cut -= 1
      lines.push(line.slice(0, cut))
      line = line.slice(cut)
    }
  }
  if (line) lines.push(line)
  if (lines.length > maxLines) {
    lines.length = maxLines
    lines[maxLines - 1] = lines[maxLines - 1].replace(/.$/, '…')
  }
  return lines
}

// 사이트 마크(육각형, scripts/icons.mjs가 만든 public/img/mark.svg). 흰 마크를 마스크로 써서 원하는 색을 입힌다.
const markSvg = (await readFile(join(root, 'public/img/mark.svg'))).toString('base64')
const markDefs = (id, x, y, size) => `<mask id="${id}" maskUnits="userSpaceOnUse" x="0" y="0" width="1200" height="630"><image x="${x}" y="${y}" width="${size}" height="${size}" href="data:image/svg+xml;base64,${markSvg}"/></mask>`

function cardSvg({ kicker, title }) {
  const lines = wrap(title)
  const size = lines.length > 2 ? 68 : 76
  const top = 330 - ((lines.length - 1) * size * 1.25) / 2
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
<rect width="1200" height="630" fill="#ffffff"/>
<rect x="0" y="0" width="14" height="630" fill="#1b1b1b"/>
<defs>${markDefs('mark', 1016, 52, 132)}</defs>
<rect width="1200" height="630" fill="#1b1b1b" mask="url(#mark)"/>
<text x="80" y="136" font-family="Pretendard" font-size="28" font-weight="700" letter-spacing="5" fill="#6b6b6b">${xml(kicker)}</text>
${lines.map((line, index) => `<text x="78" y="${top + index * size * 1.25}" font-family="Pretendard" font-size="${size}" font-weight="700" fill="#000000">${xml(line)}</text>`).join('\n')}
<text x="80" y="556" font-family="Pretendard" font-size="30" font-weight="500" fill="#474747">${xml(SITE.name)} · ${xml(SITE.url.replace('https://', ''))}</text>
</svg>`
}

// 첫 화면 링크 미리보기는 첫 화면 맨 아래 명함과 같은 모양으로 그린다.
// 차콜 종이 위에 은박(그라데이션) 서명과 안쪽 실선 테두리.
const signature = (await readFile(join(root, 'public/img/signature.png'))).toString('base64')

function namecardSvg() {
  const silver = `<linearGradient id="silver" x1="0" y1="0" x2="1" y2="1">
  <stop offset="0" stop-color="#8e959c"/><stop offset="0.38" stop-color="#c9ced3"/><stop offset="0.5" stop-color="#f2f4f6"/><stop offset="0.64" stop-color="#b3b9bf"/><stop offset="1" stop-color="#82898f"/>
</linearGradient>`
  const contacts = [['E', SITE.email], ['G', SITE.github.replace('https://', '')], ['W', SITE.url.replace('https://', '')]]
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1200" height="630" viewBox="0 0 1200 630">
<defs>
${silver}
<linearGradient id="paper" x1="0" y1="0" x2="0.35" y2="1"><stop offset="0" stop-color="#262522"/><stop offset="1" stop-color="#161615"/></linearGradient>
<filter id="white" x="0" y="0" width="1" height="1"><feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 1 0"/></filter>
<mask id="sign" maskUnits="userSpaceOnUse" x="0" y="0" width="1200" height="630"><image x="820" y="420" width="300" height="121" preserveAspectRatio="xMidYMid meet" filter="url(#white)" xlink:href="data:image/png;base64,${signature}"/></mask>
</defs>
<rect width="1200" height="630" fill="url(#paper)"/>
<rect x="28" y="28" width="1144" height="574" rx="14" fill="none" stroke="#c9ced3" stroke-opacity="0.22" stroke-width="1.5"/>
<text x="96" y="168" font-family="Pretendard" font-size="76" font-weight="700" letter-spacing="3" fill="#ececec">${xml(SITE.name)}</text>
<text x="98" y="232" font-family="Pretendard" font-size="28" font-weight="500" fill="#a3a3a3">${xml(SITE.role)}</text>
<text x="324" y="231" font-family="Pretendard" font-size="19" font-weight="700" letter-spacing="7" fill="#7a7a7a">FRONTEND DEVELOPER</text>
${contacts.map(([label, value], index) => `<text x="98" y="${452 + index * 46}" font-family="Pretendard" font-size="17" font-weight="700" letter-spacing="3" fill="#7a7a7a">${label}</text>
<text x="136" y="${452 + index * 46}" font-family="Pretendard" font-size="27" font-weight="500" fill="#ececec">${xml(value)}</text>`).join('')}
<g transform="rotate(-4 970 480)"><rect x="800" y="400" width="340" height="160" fill="url(#silver)" mask="url(#sign)"/></g>
</svg>`
}

function renderCard(card) {
  const svg = card.namecard ? namecardSvg() : cardSvg(card)
  const image = new Resvg(svg, { font: { fontFiles: fonts, loadSystemFonts: false, defaultFontFamily: 'Pretendard' } })
  return image.render().asPng()
}

for (const page of pages) {
  const file = page.path === '/' ? 'index.html' : join(decodeURIComponent(page.path), 'index.html')
  await write(join(dist, file), fill(page))
  if (page.card) await write(join(dist, 'og', `${page.card.file}.png`), renderCard(page.card))
}

// 첫 화면 링크 미리보기(명함 모양). seo.ts의 homeMeta가 이 파일을 가리킨다.
await write(join(dist, 'og', 'home.png'), renderCard({ namecard: true }))

// GitHub Pages는 없는 주소에 404.html을 내준다. 빌드 뒤에 발행된 글은 여기서 앱이 떠서 그려 준다.
await write(join(dist, '404.html'), fill({ ...notFound, path: '/404.html' }))

const indexed = pages.filter((page) => !page.meta.noindex)
await write(join(dist, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${indexed.map((page) => `  <url><loc>${xml(absolute(page.path))}</loc>${page.updatedAt ? `<lastmod>${xml(page.updatedAt.slice(0, 10))}</lastmod>` : ''}${page.priority ? `<priority>${page.priority.toFixed(1)}</priority>` : ''}</url>`).join('\n')}
</urlset>
`)

await write(join(dist, 'robots.txt'), `User-agent: *\nAllow: /\nDisallow: /write/\n\nSitemap: ${SITE.url}/sitemap.xml\n`)

// 애드센스 게시자 ID가 있으면 ads.txt를 만든다. 승인 심사와 광고 판매 인증에 필요하다.
if (SITE.adsense) {
  await write(join(dist, 'ads.txt'), `google.com, ${SITE.adsense.replace(/^ca-/, '')}, DIRECT, f08c47fec0942fa0\n`)
}

// RSS 본문: 사이트 안 주소를 절대 주소로 바꾸고, 리더에서 쓸모없는 복사 버튼과 제목 링크(#)는 뺀다.
const feedBody = (html) => html
  .replace(/<button[^>]*>.*?<\/button>/g, '')
  .replace(/<a class="anchor"[^>]*>#<\/a>/g, '')
  .replace(/(src|href)="\//g, `$1="${SITE.url}/`)
  .replaceAll(']]>', ']]]]><![CDATA[>')

const postPages = pages.filter((page) => page.data?.post)
await write(join(dist, 'rss.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">
<channel>
  <title>${xml(SITE.name)} 블로그</title>
  <link>${SITE.url}/blog/</link>
  <description>${xml(SITE.description)}</description>
  <language>ko</language>
  <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
  <atom:link href="${SITE.url}/rss.xml" rel="self" type="application/rss+xml"/>
${postPages.map((page) => `  <item>
    <title>${xml(page.data.post.title)}</title>
    <link>${xml(absolute(page.path))}</link>
    <guid>${xml(absolute(page.path))}</guid>
    ${page.data.post.date ? `<pubDate>${new Date(page.data.post.date).toUTCString()}</pubDate>` : ''}
    <description>${xml(page.meta.description)}</description>
${(page.data.post.tags ?? []).map((tag) => `    <category>${xml(tag)}</category>`).join('\n')}
    <author>${xml(SITE.email)} (${xml(SITE.name)})</author>
    ${page.feedHtml ? `<content:encoded><![CDATA[${feedBody(page.feedHtml)}]]></content:encoded>` : ''}
  </item>`).join('\n')}
</channel>
</rss>
`)

console.log(`미리 만든 페이지 ${pages.length}개, 글 ${posts.length}개, 썸네일 ${pages.filter((page) => page.card).length}개`)
