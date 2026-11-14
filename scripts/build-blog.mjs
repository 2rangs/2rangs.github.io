import { mkdir, writeFile } from 'node:fs/promises'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { createIndex } from 'pagefind'

const endpoint = process.env.SUPABASE_URL || 'https://wbtbmarooytomtynuvoe.supabase.co'
const key = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY
if (!key && process.env.BLOG_ALLOW_UNCONFIGURED !== 'true') throw new Error('Set SUPABASE_PUBLISHABLE_KEY or SUPABASE_ANON_KEY before building')
const base = (process.env.BLOG_BASE_PATH ?? '/2rangs_IT').replace(/\/$/, '')
const url = new URL('/rest/v1/blog_posts', endpoint)
url.search = new URLSearchParams({
    select: 'id,slug,title,summary,body_markdown,tags,published_at',
    order: 'published_at.desc,id.asc',
})

const posts = []
const pageSize = 100
if (!key) console.warn('Supabase key is unset. Publishing the portfolio and an empty blog.')
for (let offset = 0; key; offset += pageSize) {
    url.searchParams.set('limit', pageSize)
    url.searchParams.set('offset', offset)
    const response = await fetch(url, { headers: { apikey: key }, signal: AbortSignal.timeout(15000) })
    if (!response.ok) throw new Error(`Supabase blog lookup failed (${response.status})`)
    const page = await response.json()
    posts.push(...page)
    if (page.length < pageSize) break
}

const pathFor = (slug) => `${base}/posts/${slug}/`
const dateFormat = new Intl.DateTimeFormat('ko-KR', { dateStyle: 'long', timeZone: 'Asia/Seoul' })
const date = (post) => h('time', { dateTime: post.published_at }, dateFormat.format(new Date(post.published_at)))

function document(title, description, body, search = false) {
    return '<!doctype html>' + renderToStaticMarkup(h('html', { lang: 'ko' },
        h('head', null,
            h('meta', { charSet: 'utf-8' }),
            h('meta', { name: 'viewport', content: 'width=device-width, initial-scale=1' }),
            h('title', null, title),
            h('meta', { name: 'description', content: description }),
            h('link', { rel: 'stylesheet', href: `${base}/blog.css` }),
            search && h('link', { rel: 'stylesheet', href: `${base}/pagefind/pagefind-ui.css` })),
        h('body', null,
            h('header', null, h('a', { href: `${base}/blog/` }, '2rang25 블로그'),
                h('a', { href: `${base}/` }, '포트폴리오')),
            h('main', null, body),
            search && h('script', { src: `${base}/pagefind/pagefind-ui.js` }),
            search && h('script', { src: `${base}/blog-search.js` }))))
}

async function writePage(directory, html) {
    await mkdir(directory, { recursive: true })
    await writeFile(`${directory}/index.html`, html)
}

await writePage('dist/blog', document('2rang25 블로그', '프론트엔드 개발 블로그', [
    h('h1', { key: 'title' }, '블로그'),
    posts.length > 0 && h('div', { key: 'search', id: 'blog-search' }),
    posts.length === 0
        ? h('p', { key: 'empty' }, '아직 발행된 글이 없습니다.')
        : h('ul', { key: 'posts', className: 'posts' }, posts.map(post =>
            h('li', { key: post.id }, date(post),
                h('h2', null, h('a', { href: pathFor(post.slug) }, post.title)),
                h('p', null, post.summary)))),
], posts.length > 0))

for (const post of posts) {
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(post.slug)) throw new Error('Invalid post slug')
    await writePage(`dist/posts/${post.slug}`, document(`${post.title} | 2rang25 블로그`, post.summary, [
        h('article', { key: 'post', 'data-pagefind-body': '' },
            h('h1', { 'data-pagefind-meta': 'title' }, post.title),
            date(post),
            h('p', null, post.tags.join(' · ')),
            h(Markdown, { remarkPlugins: [remarkGfm] }, post.body_markdown)),
        h('section', { key: 'comments', 'aria-label': '댓글' },
            h('h2', null, '댓글'),
            h('script', {
                src: 'https://giscus.app/client.js',
                'data-repo': '2rangs/2rang25',
                'data-repo-id': 'R_kgDOLZGXSg',
                'data-category': 'Comments',
                'data-category-id': 'DIC_kwDOLZGXSs4Ck1Vx',
                'data-mapping': 'specific',
                'data-term': `blog-post-${post.id}`,
                'data-strict': '1',
                'data-theme': 'dark',
                'data-lang': 'ko',
                'data-loading': 'lazy',
                crossOrigin: 'anonymous',
                async: true,
            })),
    ]))
}

if (posts.length) {
    const { index, errors } = await createIndex()
    if (!index || errors.length) throw new Error(errors.join('\n') || 'Could not create search index')
    try {
        const indexed = await index.addDirectory({ path: 'dist', glob: 'posts/**/index.html' })
        if (indexed.errors.length) throw new Error(indexed.errors.join('\n'))
        const written = await index.writeFiles({ outputPath: 'dist/pagefind' })
        if (written.errors.length) throw new Error(written.errors.join('\n'))
    } finally {
        await index.deleteIndex()
    }
}
