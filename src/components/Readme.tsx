import { useEffect, useState } from 'react'
import { Markdown } from './Markdown'

// https://github.com/<owner>/<repo> 형태의 주소에서 저장소 이름을 꺼낸다. GitHub 저장소가 아니면 null.
export function githubRepo(link?: string) {
  const match = link && /^https:\/\/github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/.exec(link)
  return match ? `${match[1]}/${match[2]}` : null
}

const FILES = { ko: 'README.ko.md', en: 'README.md' } as const
type Lang = keyof typeof FILES

// README 맨 위의 언어 전환 줄([English](README.md) · 한국어)은 상자 머리의 버튼이 대신하므로 뺀다.
const stripLanguageLine = (text: string) => text.replace(/^(?=.*English)(?=.*한국어).*\]\(README(\.ko)?\.md\).*\r?\n(\r?\n)?/m, '')

// 저장소의 README를 GitHub에서 그대로 읽어 보여 준다. 저장소를 고치면 다시 배포하지 않아도 반영된다.
// 한국어 README(README.ko.md)가 있으면 그것부터 보여 주고, 영어 README와 바꿔 볼 수 있다.
export function Readme({ repo }: { repo: string }) {
  const [lang, setLang] = useState<Lang>('ko')
  const [texts, setTexts] = useState<Partial<Record<Lang, string>>>({})
  const [missing, setMissing] = useState<Partial<Record<Lang, boolean>>>({})
  const raw = `https://raw.githubusercontent.com/${repo}/HEAD/`
  const blob = `https://github.com/${repo}/blob/HEAD/`

  useEffect(() => {
    const controller = new AbortController()
    setTexts({})
    setMissing({})
    setLang('ko')
    for (const key of Object.keys(FILES) as Lang[]) {
      fetch(raw + FILES[key], { signal: controller.signal })
        .then((response) => (response.ok ? response.text() : Promise.reject(new Error(String(response.status)))))
        .then((text) => setTexts((prev) => ({ ...prev, [key]: stripLanguageLine(text) })))
        .catch((error) => { if (error.name !== 'AbortError') setMissing((prev) => ({ ...prev, [key]: true })) })
    }
    return () => controller.abort()
  }, [raw])

  // 한국어가 없으면 영어로 보여 준다.
  const shown: Lang = lang === 'ko' && missing.ko ? 'en' : lang
  const text = texts[shown]
  const failed = missing.ko && missing.en
  const both = texts.ko !== undefined && texts.en !== undefined

  // README 안의 상대 주소는 저장소 기준이다. 이미지는 원본 파일로, 링크는 GitHub 화면으로 보낸다.
  const resolve = (url: string, key: string) => {
    if (/^([a-z][a-z\d+.-]*:|#|\/\/)/i.test(url)) return url
    const path = url.replace(/^\.?\//, '')
    return key === 'src' ? raw + path : blob + path
  }

  return (
    <section className="readme" aria-labelledby="readme-title">
      <header className="readme-head">
        <h2 id="readme-title">{FILES[shown].replace(/\.md$/, '')}<span>.md</span></h2>
        {both && (
          <div className="readme-lang" role="group" aria-label="README 언어">
            <button type="button" aria-pressed={shown === 'ko'} onClick={() => setLang('ko')}>한국어</button>
            <button type="button" aria-pressed={shown === 'en'} onClick={() => setLang('en')}>English</button>
          </div>
        )}
        <a href={`https://github.com/${repo}`} target="_blank" rel="noreferrer">{repo}</a>
      </header>
      <div className="readme-body">
        {text !== undefined ? (
          <Markdown resolve={resolve}>{text}</Markdown>
        ) : failed ? (
          <p className="muted">README를 불러오지 못했습니다. <a href={`https://github.com/${repo}#readme`} target="_blank" rel="noreferrer">GitHub에서 보기</a></p>
        ) : (
          <p className="muted" aria-live="polite">README를 불러오는 중…</p>
        )}
      </div>
    </section>
  )
}
