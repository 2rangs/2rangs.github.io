
혼자 쓰는 스킬은 `~/.claude/skills/`에 두면 된다. 고민은 그 스킬이 쓸 만해졌을 때 시작된다. 디자인 시스템 리뷰 스킬을 팀원 모두가 같은 버전으로 쓰게 하고, 다른 저장소에서도 쓰고, 고친 내용이 각자의 컴퓨터에 반영되게 하려면 배포 방법을 정해야 한다.

이 연재의 마지막 글에서는 공유 방법을 범위가 좁은 것부터 차례로 정리한다. 저장소 커밋, 플러그인, 마켓플레이스, 버전 관리 순이다. 그리고 남이 만든 스킬을 들여올 때의 보안 수칙으로 마무리한다. 명령과 파일 형식은 작성 시점의 Claude Code 공식 문서를 기준으로 했다.

## 공유 범위는 세 단계

Claude Code 스킬 문서는 대상에 따라 세 가지 배포 범위를 제시한다.

- **프로젝트 스킬**: `.claude/skills/`를 버전 관리에 커밋한다.
- **플러그인**: 플러그인 안에 `skills/` 디렉터리를 만든다.
- **관리형(managed)**: 관리형 설정으로 조직 전체에 배포한다.

대부분의 팀은 첫 번째로 시작해서 두 번째로 넘어간다. 세 번째는 조직 관리자가 맡는 일이라 이 글에서는 간단히만 다룬다.

## 저장소에 두기

가장 단순한 방법이다. [Claude Code에서 스킬 만들고 쓰기](/blog/claude-code-skills-in-practice/)에서 본 것처럼 프로젝트 스킬은 `.claude/skills/<skill-name>/SKILL.md`에 두고, 커밋하면 그 저장소에서 작업하는 모두가 같은 스킬을 받는다.

```text
frontend-app/
├── CLAUDE.md
└── .claude/
    ├── skills/
    │   ├── design-system/
    │   │   ├── SKILL.md
    │   │   └── tokens.md
    │   └── component-review/
    │       └── SKILL.md
    └── agents/
        └── a11y-auditor.md
```

별도 인프라가 필요 없다는 것이 장점이다. 스킬 수정도 일반 코드처럼 PR로 리뷰하고, 변경 이력은 git에 남는다.

다만 그 저장소 안에서만 쓸 수 있다. 같은 디자인 시스템을 쓰는 저장소가 셋이면 스킬도 세 벌이 되고, 시간이 지나면 서로 달라진다. [스킬 vs MCP vs 서브에이전트](/blog/skills-vs-mcp-subagents-claude-md/)에서 인용한 문서의 도입 순서표에서도 "두 번째 저장소에 같은 구성이 필요해지면 플러그인"이라고 정리한다.

이름 충돌 규칙도 알아 두면 좋다. 같은 이름의 스킬이 여러 위치에 있으면 엔터프라이즈가 개인보다, 개인이 프로젝트보다 우선한다. 팀원 한 명의 `~/.claude/skills/design-system/`이 저장소의 같은 이름 스킬보다 먼저 쓰일 수 있다. 사람마다 동작이 다르다면 먼저 여기를 확인한다.

## 플러그인으로 묶기

플러그인은 스킬, 서브에이전트, 훅, MCP 서버 등을 한 단위로 설치하고 로드하는 디렉터리다. 문서는 한 프로젝트나 나 혼자만 쓰는 동안은 단독 구성을 유지하고, 팀원과 공유하거나 여러 프로젝트에 설치하거나 버전이 붙은 릴리스를 내고 싶을 때 플러그인을 만들라고 한다.

구조는 이렇다. 매니페스트는 `.claude-plugin/plugin.json`이고, 구성 요소는 플러그인 루트에 둔다.

```text
fe-design-kit/
├── .claude-plugin/
│   └── plugin.json
├── skills/
│   ├── design-system/
│   │   └── SKILL.md
│   └── component-review/
│       └── SKILL.md
└── agents/
    └── a11y-auditor.md
```

```json
{
  "name": "fe-design-kit",
  "description": "프론트엔드 팀 디자인 시스템 스킬 모음",
  "version": "1.0.0",
  "author": { "name": "Frontend Team" }
}
```

필수는 `name` 하나다. 이 이름이 플러그인 안 모든 스킬과 에이전트의 접두사가 되므로 공백을 넣지 않는다. 문서가 특히 강조하는 주의점이 있다. `.claude-plugin/` 안에는 `plugin.json`만 둔다. 구성 요소를 그 안에 넣으면 로드되지 않는다.

플러그인 스킬은 네임스페이스가 붙는다. 위 플러그인의 `design-system` 스킬은 `/fe-design-kit:design-system`으로 실행된다. 덕분에 두 플러그인에 같은 이름의 스킬이 있어도 충돌하지 않는다. 대신 기존에 `/design-system`으로 쓰던 팀원에게는 이름이 바뀐다는 점을 알려야 한다.

### 기존 `.claude/` 구성을 옮기기

이미 저장소에 스킬과 에이전트가 있다면 다시 쓸 필요 없이 복사하면 된다. 문서의 절차를 요약하면 이렇다.

```bash
mkdir -p fe-design-kit/.claude-plugin
# plugin.json 작성 후
cp -r .claude/skills fe-design-kit/
cp -r .claude/agents fe-design-kit/

# 매니페스트와 SKILL.md frontmatter 검사
claude plugin validate ./fe-design-kit

# 설치 없이 이번 세션에만 로드해서 확인
claude --plugin-dir ./fe-design-kit
```

옮긴 뒤 원본을 `.claude/`에 그대로 두면 `/design-system`과 `/fe-design-kit:design-system`이 둘 다 뜬다. 스킬과 에이전트는 접두사 덕에 충돌하지 않지만, 훅은 접두사가 없어서 설정 파일과 플러그인 양쪽에 있으면 이벤트마다 두 번 실행된다. 플러그인이 잘 동작하는지 확인한 뒤 원본을 지운다.

## 마켓플레이스로 배포하기

마켓플레이스는 `.claude-plugin/marketplace.json` 파일이 있는 디렉터리나 저장소다. 플러그인 목록과 각 플러그인을 가져올 위치를 적은 카탈로그이고, 호스팅되는 스토어가 아니다. 팀 마켓플레이스는 사내 git 저장소 하나로 충분하다.

```json
{
  "name": "acme-frontend-plugins",
  "description": "프론트엔드 팀 플러그인",
  "owner": { "name": "Frontend Team" },
  "plugins": [
    {
      "name": "fe-design-kit",
      "source": "./plugins/fe-design-kit",
      "description": "디자인 시스템 스킬 모음"
    }
  ]
}
```

필수 필드는 `name`, `owner`, `plugins`다. 각 항목에는 `name`과 `source`가 필요하다. 상대 경로 `source`는 `.claude-plugin/`이 아니라 그 바깥의 마켓플레이스 루트를 기준으로 쓰고, `..`는 쓸 수 없다. 문서는 새 마켓플레이스에서 설치가 실패하는 흔한 원인으로 두 가지를 꼽는다. 기준 디렉터리를 잘못 잡은 상대 경로, 그리고 항목의 `name`과 플러그인 `plugin.json`의 `name`이 다른 경우다. 두 이름은 같게 맞춘다. 플러그인이 별도 GitHub 저장소에 있다면 `{ "source": "github", "repo": "your-org/fe-design-kit" }`처럼 소스 객체를 쓴다.

팀원 쪽 흐름은 두 명령이다.

```bash
claude plugin marketplace add your-org/acme-frontend-plugins
claude plugin install fe-design-kit@acme-frontend-plugins
```

설치 ID는 `<항목 이름>@<마켓플레이스 이름>`이다. 마켓플레이스 이름은 저장소 이름이 아니라 `marketplace.json`의 `name`에서 온다. 한 사용자가 같은 이름의 마켓플레이스 두 개를 동시에 등록할 수 없으니, 다른 팀과 겹치지 않을 이름을 고른다.

### 저장소 단위로 요구하기

특정 저장소에서 일하는 모두가 이 플러그인을 쓰게 하려면 그 저장소의 `.claude/settings.json`에 `extraKnownMarketplaces`와 `enabledPlugins`를 둔다.

```json
{
  "extraKnownMarketplaces": {
    "acme-frontend-plugins": {
      "source": { "source": "github", "repo": "your-org/acme-frontend-plugins" }
    }
  },
  "enabledPlugins": {
    "fe-design-kit@acme-frontend-plugins": true
  }
}
```

문서 기준으로 두 가지를 주의해야 한다. 마켓플레이스 등록은 팀원이 그 폴더의 작업 공간 신뢰 대화상자를 수락한 뒤에만 적용된다. 그리고 `enabledPlugins`를 적는다고 설치까지 되지는 않는다. 각자 `--scope project`로 한 번 설치해야 한다. 조직 전체에 강제하려면 같은 키를 관리형 설정에 넣으며, 이 부분은 관리자 문서를 따른다.

## 버전 관리

플러그인 업데이트가 사용자에게 언제 닿는지는 `version` 필드가 정한다. 문서의 규칙을 정리하면 이렇다.

- 사용자는 플러그인의 계산된 버전이 바뀔 때만 새 사본을 받는다. 버전은 `plugin.json`을 먼저 보고, 없으면 마켓플레이스 항목을 본다.
- **릴리스마다 `version`을 올리는 방식**: 문자열이 바뀌기 전까지 사용자는 캐시된 사본에 머문다. `"1.0.0"`으로 둔 채 커밋만 밀어 넣으면 아무도 받지 못한다.
- **`version`을 아예 빼는 방식**: 사용자가 커밋을 따라간다. 이때는 `plugin.json`과 마켓플레이스 항목 양쪽에서 모두 뺀다.
- 양쪽에 다 적지 않는다. 그러면 경고 없이 `plugin.json` 값이 쓰이고, `claude plugin validate`가 불일치를 보고한다.
- `version`은 semver로 검사되지 않는 문자열이다.

하나 더 알아 둘 점이 있다. 마켓플레이스의 백그라운드 자동 업데이트는 기본으로 꺼져 있고, `marketplace.json`에는 이를 켜는 필드가 없다. 각 사용자가 `/plugin`의 Marketplaces 탭에서 켜거나, 관리자가 관리형 설정에서 켠다. 꺼져 있으면 사용자가 `claude plugin update <plugin>@<marketplace>`를 실행할 때 반영된다. 버전을 올리기 전에는 [스킬 테스트와 평가](/blog/testing-skills/)의 평가 세트를 다시 돌린다.

> **참고** API로 올린 사용자 스킬은 버전 체계가 따로 있다. skills-guide 문서는 프로덕션에서 특정 버전을 고정하라고 권한다. `"latest"`를 쓰면 워크스페이스의 누군가가 올린 새 버전이 곧바로 동작을 바꾼다. 업로드 방법은 [Claude API에서 스킬 쓰기](/blog/skills-on-the-claude-api/)에서 다뤘다.

## 신뢰할 수 있는 스킬만 쓰기

공유가 쉬워지면 남의 스킬을 들여오기도 쉬워진다. Agent Skills 개요 문서의 보안 항목은 직접 만들었거나 Anthropic에서 받은 것처럼 신뢰할 수 있는 출처의 스킬만 쓰라는 문장으로 시작한다. 스킬은 지시와 코드로 Claude에게 능력을 주므로, 악의적인 스킬은 설명과 다른 방식으로 도구를 호출하거나 코드를 실행하게 만들 수 있다.

플러그인은 위험 범위가 더 넓다. 플러그인 보안 문서에 따르면 설치한 플러그인은 사용자 권한으로 임의의 코드를 실행할 수 있다. 훅은 생명주기 시점마다 셸 명령으로 돌고, stdio MCP 서버는 로컬 프로세스로 뜨며, `bin/`의 실행 파일은 Bash 도구의 `PATH`에 추가된다. 또 권한 규칙과 샌드박스는 Claude의 도구 호출에만 적용되고, 플러그인이 스스로 실행하는 훅이나 서버 프로세스에는 적용되지 않는다.

문서 내용을 바탕으로 팀 수칙을 정리하면 이렇다.

- **모든 파일을 읽는다.** `SKILL.md`뿐 아니라 스크립트와 리소스까지 본다. 예상하지 못한 네트워크 호출, 목적과 맞지 않는 파일 접근을 찾는다. 플러그인이라면 `hooks/hooks.json`, `.mcp.json`, `bin/`을 반드시 연다. `/plugin` 상세 화면에는 훅이 있다는 것만 나오고 무엇을 실행하는지는 나오지 않는다.
- **설치 전에 구성 목록을 확인한다.** `claude plugin marketplace list`로 마켓플레이스의 출처를 확인한다. 설치 후에는 `claude plugin details <plugin>`으로 실제로 들어온 스킬, 에이전트, 훅, 서버 목록을 본다.
- **외부 URL에서 내용을 가져오는 스킬을 경계한다.** 가져온 내용에 악의적인 지시가 섞일 수 있다. 처음에 믿을 만했던 스킬도 외부 의존성이 바뀌면 안전하지 않게 될 수 있다.
- **`allowed-tools`를 리뷰한다.** 문서는 스킬이 스스로에게 넓은 도구 권한을 줄 수 있으니, 저장소에 커밋된 스킬의 `allowed-tools`를 확인한 뒤에 그 저장소에서 Claude Code를 실행하라고 한다. 스킬 PR 리뷰 체크리스트에 이 항목을 넣는다.
- **자동 업데이트가 무엇을 뜻하는지 안다.** 자동 업데이트가 켜져 있으면 검토한 파일이 디스크에서 바뀔 수 있다. 외부 마켓플레이스라면 자동 업데이트를 켜기 전에 한 번 더 생각한다. 마켓플레이스를 추가할 때 `your-org/your-marketplace#stable`처럼 `#<ref>`를 붙이면 카탈로그의 특정 브랜치나 태그를 받을 수 있다.
- **마켓플레이스 이름을 믿지 않는다.** 이름은 카탈로그를 누가 내는지 알려 줄 뿐, 각 플러그인이 무엇을 하는지는 알려 주지 않는다. 문서도 어느 마켓플레이스에서 왔든 설치 전에 검토하라고 한다.

## 정리

- 공유는 저장소 커밋, 플러그인, 관리형 배포 순으로 범위가 넓어진다. 한 저장소면 `.claude/skills/` 커밋으로 충분하다.
- 두 번째 저장소가 생기면 플러그인으로 묶는다. `.claude-plugin/`에는 `plugin.json`만 두고, 스킬 이름에 플러그인 접두사가 붙는다는 점을 팀에 알린다.
- 마켓플레이스는 `marketplace.json` 하나짜리 카탈로그다. 항목 이름과 매니페스트 이름을 맞추고, 저장소의 `.claude/settings.json`으로 팀원에게 요구할 수 있다.
- 업데이트는 `version`이 바뀔 때만 전달된다. 릴리스마다 올리거나 아예 빼고, 두 곳에 동시에 적지 않는다.
- 스킬과 플러그인은 소프트웨어 설치처럼 다룬다. 출처를 확인하고, 모든 파일을 읽고, `allowed-tools`와 훅을 리뷰한다.

## 참고

- https://code.claude.com/docs/en/skills
- https://code.claude.com/docs/en/plugins
- https://code.claude.com/docs/en/plugins/create
- https://code.claude.com/docs/en/plugins/create-marketplace
- https://code.claude.com/docs/en/plugins/host-marketplace
- https://code.claude.com/docs/en/plugins/org
- https://code.claude.com/docs/en/plugins/security
- https://code.claude.com/docs/en/plugins/manifest-reference
- https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview
- https://platform.claude.com/docs/en/build-with-claude/skills-guide
