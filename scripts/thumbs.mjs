// 글·포트폴리오 대표 이미지(PNG)의 작은 WebP 버전을 만든다. 목록과 카드는 화면에 맞는 크기를 골라 받는다(srcset).
//   node scripts/thumbs.mjs          새로 생기거나 바뀐 이미지만
//   node scripts/thumbs.mjs --force  전부 다시
// cwebp가 필요하다(macOS: brew install webp). 결과는 public/img/thumbs/ 와 src/lib/thumbs.json 에 커밋한다.
// thumbs.json에 없는 이미지는 원본 PNG만 쓰므로, 이 스크립트를 깜빡해도 이미지가 깨지지는 않는다.
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const root = join(import.meta.dirname, '..')
const out = join(root, 'public/img/thumbs')
const force = process.argv.includes('--force')
const WIDTHS = [320, 600, 1200]
const done = []

for (const dir of ['covers', 'projects']) {
  const from = join(root, 'public/img', dir)
  for (const file of readdirSync(from).filter((name) => name.endsWith('.png')).sort()) {
    const name = file.replace(/\.png$/, '')
    const source = join(from, file)
    for (const width of WIDTHS) {
      const target = join(out, `${dir}-${name}-${width}.webp`)
      if (!force && existsSync(target) && statSync(target).mtimeMs >= statSync(source).mtimeMs) continue
      execFileSync('cwebp', ['-quiet', '-q', '78', '-resize', String(width), '0', source, '-o', target])
    }
    done.push(`${dir}/${name}`)
  }
}

writeFileSync(join(root, 'src/lib/thumbs.json'), JSON.stringify(done, null, 0) + '\n')
console.log(`WebP 썸네일: ${done.length}개 이미지 × ${WIDTHS.length}개 크기`)
