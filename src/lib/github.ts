// https://github.com/<owner>/<repo> 형태의 주소에서 저장소 이름을 꺼낸다. GitHub 저장소가 아니면 null.
export function githubRepo(link?: string) {
  const match = link && /^https:\/\/github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/.exec(link)
  return match ? `${match[1]}/${match[2]}` : null
}
