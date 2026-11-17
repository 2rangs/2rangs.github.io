import { Layout } from '../components/Layout'
import { paths } from '../lib/routes'

export function NotFound() {
  return (
    <Layout section="none">
      <div className="shell page-head">
        <p className="label">404</p>
        <h1>페이지를 찾을 수 없습니다</h1>
        <p className="section-lead">주소가 바뀌었거나 삭제된 페이지입니다.</p>
        <div className="hero-actions">
          <a className="button primary" href={paths.home}>홈으로</a>
          <a className="button ghost" href={paths.blog}>블로그</a>
        </div>
      </div>
    </Layout>
  )
}
