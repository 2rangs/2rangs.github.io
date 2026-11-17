import { formatDate, shortDate, type PostSummary } from '../lib/posts'
import { paths } from '../lib/routes'

// 블로그 목록과 홈의 최근 글에서 같이 쓰는 한 줄. 날짜를 왼쪽 열에 두어 시간 순서가 한눈에 보이게 한다.
export function PostRow({ post, showYear = false }: { post: PostSummary; showYear?: boolean }) {
  return (
    <li className="post-row">
      <time className="post-date" dateTime={post.date || undefined} title={formatDate(post.date)}>
        {showYear ? formatDate(post.date) : shortDate(post.date)}
      </time>
      <div className="post-main">
        <h3><a href={paths.post(post.key)}>{post.title}</a></h3>
        {post.summary && <p>{post.summary}</p>}
        <div className="post-facts">
          {post.draft && <span className="badge">초안</span>}
          {post.tags.map((tag) => <a className="tag" key={tag} href={paths.tag(tag)}>{tag}</a>)}
          {post.minutes > 0 && <span>{post.minutes}분 분량</span>}
        </div>
      </div>
    </li>
  )
}
