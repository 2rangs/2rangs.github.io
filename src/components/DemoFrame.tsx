import { useState } from 'react'
import { SITE } from '../lib/site'

// 실제로 배포된 프로젝트 사이트를 페이지 안에서 바로 돌려 볼 수 있게 한다.
// 사이트가 무거워서 처음에는 대표 이미지만 보여 주고, 누르면 그때 불러온다.
export function DemoFrame({ src, title, cover }: { src: string; title: string; cover?: string }) {
  const [running, setRunning] = useState(false)
  const shown = src.startsWith('/') ? `${new URL(SITE.url).host}${src}` : src.replace(/^https?:\/\//, '')

  return (
    <figure className="demo-frame" aria-label={`${title} 실행 화면`}>
      <div className="demo-bar">
        <span className="demo-dots" aria-hidden="true"><i /><i /><i /></span>
        <span className="demo-url">{shown}</span>
        <a href={src} target="_blank" rel="noreferrer">새 창에서 열기<span aria-hidden="true"> ↗</span></a>
      </div>
      <div className="demo-view">
        {running ? (
          <iframe src={src} title={`${title} 실행 화면`} allow="clipboard-write; fullscreen" />
        ) : (
          <button type="button" className="demo-start" onClick={() => setRunning(true)}>
            {cover && <img src={`/${cover}`} alt="" decoding="async" />}
            <span className="demo-play"><span aria-hidden="true">▶</span> 여기서 바로 써 보기</span>
          </button>
        )}
      </div>
    </figure>
  )
}
