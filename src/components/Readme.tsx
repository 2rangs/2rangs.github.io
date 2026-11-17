import { useEffect, useState } from 'react'
import { Markdown } from './Markdown'

// https://github.com/<owner>/<repo> 형태의 주소에서 저장소 이름을 꺼낸다. GitHub 저장소가 아니면 null.
export function githubRepo(link?: string) {
  const match = link && /^https:\/\/github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/.exec(link)
  return match ? `${match[1]}/${match[2]}` : null
}

// 저장소의 README를 GitHub에서 그대로 읽어 보여 준다. 저장소를 고치면 다시 배포하지 않아도 반영된다.
export function Readme({ repo }: { repo: string }) {
  const [text, setText] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const raw = `https://raw.githubusercontent.com/${repo}/HEAD/`
  const blob = `https://github.com/${repo}/blob/HEAD/`

  useEffect(() => {
    const controller = new AbortController()
    setText(null)
    setFailed(false)
    fetch(`${raw}README.md`, { signal: controller.signal })
      .then((response) => (response.ok ? response.text() : Promise.reject(new Error(String(response.status)))))
      .then(setText)
      .catch((error) => { if (error.name !== 'AbortError') setFailed(true) })
    return () => controller.abort()
  }, [raw])

  // README 안의 상대 주소는 저장소 기준이다. 이미지는 원본 파일로, 링크는 GitHub 화면으로 보낸다.
  const resolve = (url: string, key: string) => {
    if (/^([a-z][a-z\d+.-]*:|#|\/\/)/i.test(url)) return url
    const path = url.replace(/^\.?\//, '')
    return key === 'src' ? raw + path : blob + path
  }

  return (
    <section className="readme" aria-labelledby="readme-title">
      <header className="readme-head">
        <h2 id="readme-title">README<span>.md</span></h2>
        <a href={`https://github.com/${repo}`} target="_blank" rel="noreferrer">{repo}</a>
      </header>
      <div className="readme-body">
        {text !== null ? (
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
