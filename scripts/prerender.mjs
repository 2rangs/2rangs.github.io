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

const template = await readFile(join(dist, 'index.html'), 'utf8')
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

function cardSvg({ kicker, title }) {
  const lines = wrap(title)
  const size = lines.length > 2 ? 68 : 76
  const top = 330 - ((lines.length - 1) * size * 1.25) / 2
  const petals = [0, 72, 144, 216, 288].map((angle) => `<ellipse cy="-30" rx="19" ry="30" fill="#1b1b1b" transform="rotate(${angle})"/>`).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
<rect width="1200" height="630" fill="#ffffff"/>
<rect x="0" y="0" width="14" height="630" fill="#1b1b1b"/>
<g transform="translate(1085,120) rotate(-14)">${petals}<circle r="13" fill="#ffffff"/></g>
<text x="80" y="136" font-family="Pretendard" font-size="28" font-weight="700" letter-spacing="5" fill="#6b6b6b">${xml(kicker)}</text>
${lines.map((line, index) => `<text x="78" y="${top + index * size * 1.25}" font-family="Pretendard" font-size="${size}" font-weight="700" fill="#000000">${xml(line)}</text>`).join('\n')}
<text x="80" y="556" font-family="Pretendard" font-size="30" font-weight="500" fill="#474747">${xml(SITE.name)} · ${xml(SITE.url.replace('https://', ''))}</text>
</svg>`
}

function renderCard(card) {
  const image = new Resvg(cardSvg(card), { font: { fontFiles: fonts, loadSystemFonts: false, defaultFontFamily: 'Pretendard' } })
  return image.render().asPng()
}

for (const page of pages) {
  const file = page.path === '/' ? 'index.html' : join(decodeURIComponent(page.path), 'index.html')
  await write(join(dist, file), fill(page))
  if (page.card) await write(join(dist, 'og', `${page.card.file}.png`), renderCard(page.card))
}

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
