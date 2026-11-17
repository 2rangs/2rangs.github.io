import { Layout } from '../components/Layout'
import { paths } from '../lib/routes'

export function NotFound() {
  return (
    <Layout section="none">
      <div className="shell page-head narrow-text">
        <h1>찾는 페이지가 없습니다</h1>
        <p className="page-lead">주소가 바뀌었거나 삭제된 페이지입니다. 글을 찾고 있다면 블로그에서 검색해 보세요.</p>
        <div className="actions">
          <a className="button primary" href={paths.blog}>블로그에서 찾기</a>
          <a className="button ghost" href={paths.home}>홈으로</a>
        </div>
      </div>
    </Layout>
  )
}
