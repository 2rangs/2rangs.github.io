
"제 컴퓨터에선 잘 되는데요?"

개발하다 보면 한 번쯤 해 본 말이고, 한 번쯤 들어 본 말입니다. 같은 저장소를 받았는데 동료 컴퓨터에서는 빌드가 깨집니다. CI에서만 테스트가 떨어지기도 하고요.

코드는 똑같은데 왜 결과가 다를까요? 대부분은 코드가 아니라 코드를 둘러싼 환경, 즉 설치된 패키지 버전과 Node 버전, 패키지 매니저가 달라서입니다. 이 셋은 모두 파일로 고정해 둘 수 있습니다.

## 범위로 적은 버전

`package.json`의 의존성은 보통 이렇게 적혀 있습니다.

```json
{
  "dependencies": {
    "react": "^19.2.0"
  }
}
```

`^19.2.0`은 "19.2.0 이상, 20 미만이면 아무거나"라는 뜻입니다. 정확한 버전이 아니라 범위예요.

그래서 제가 지난달에 설치한 버전과 동료가 오늘 설치한 버전이 다를 수 있습니다. 직접 쓰는 패키지만 그런 게 아닙니다. 그 패키지가 쓰는 패키지, 또 그 아래 패키지까지 전부 범위로 풀립니다. 어디선가 작은 버전 하나만 달라져도 결과가 달라질 수 있죠.

## lockfile이 하는 일

이 문제를 막아 주는 파일이 `package-lock.json`입니다.

npm 공식 문서에 따르면 이 파일은 실제로 만들어진 의존성 트리를 그대로 기록합니다. 그래서 다음 설치 때도 같은 트리를 만들 수 있어요. 문서에서도 저장소에 커밋하라고 안내합니다.

가끔 lockfile이 길고 충돌도 잘 나서 `.gitignore`에 넣는 경우를 봅니다. 저도 예전에 그랬습니다. 그런데 그러면 팀원마다 다른 트리를 받게 되니 문제를 스스로 만드는 꼴이더라고요.

lockfile 충돌이 나면 손으로 고치기보다 `package.json`을 먼저 정리하고 `npm install`로 다시 만드는 편이 안전합니다.

## npm install 대신 npm ci

lockfile이 있어도 `npm install`은 상황에 따라 lockfile을 고쳐 씁니다. `package.json`과 lockfile이 어긋나 있으면 맞추려고 하거든요.

CI나 배포처럼 "기록된 그대로만 설치해 줘"가 필요한 곳에서는 `npm ci`를 씁니다. 공식 문서에 적힌 차이는 이렇습니다.

- `package-lock.json`(또는 `npm-shrinkwrap.json`)이 꼭 있어야 합니다.
- lockfile과 `package.json`이 맞지 않으면 lockfile을 고치지 않고 **에러로 끝냅니다.**
- `node_modules`가 이미 있으면 지우고 처음부터 설치합니다.
- `package.json`이나 lockfile을 절대 쓰지 않습니다.
- 패키지 하나만 추가하는 용도로는 쓸 수 없습니다.

```bash
# CI나 배포에서
npm ci

# 새 패키지를 추가할 때는 평소처럼
npm install dayjs
```

에러로 끝나는 게 오히려 장점입니다. 누군가 `package.json`만 고치고 lockfile을 커밋하지 않았다면 CI에서 바로 드러나니까요.

하나 주의할 점이 있습니다. lockfile을 만들 때 `--legacy-peer-deps` 같은 플래그를 썼다면 `npm ci`에도 같은 플래그가 필요하다고 공식 문서에 적혀 있습니다. 프로젝트의 `.npmrc`에 설정을 넣고 커밋해 두면 실수가 줄어요.

## Node 버전도 맞추기

패키지 버전을 맞춰도 Node 버전이 다르면 또 어긋납니다. 저는 Node 메이저 버전이 달라서 네이티브 모듈 빌드가 깨지는 바람에 반나절을 날린 적이 있습니다.

가장 흔한 방법은 프로젝트 루트에 `.nvmrc`를 두는 것입니다.

```bash
echo "24" > .nvmrc
nvm use
```

nvm 문서에 따르면 버전을 따로 주지 않으면 `nvm use`, `nvm install`이 이 파일을 읽습니다. 숫자 대신 `lts/*` 같은 별칭도 쓸 수 있고요.

GitHub Actions의 `actions/setup-node`도 이 파일을 읽을 수 있습니다.

```yaml
steps:
  - uses: actions/checkout@v7
  - uses: actions/setup-node@v7
    with:
      node-version-file: '.nvmrc'
  - run: npm ci
  - run: npm test
```

이렇게 하면 로컬과 CI가 같은 파일을 보고 버전을 정합니다. 버전을 두 군데에 따로 적지 않아도 돼요.

## engines와 devEngines

`package.json`에도 버전을 적을 수 있습니다. 다만 두 필드의 성격이 꽤 다릅니다.

`engines`는 문서상 권고에 가깝습니다. `engine-strict` 설정을 켜지 않으면 경고만 하고, 그것도 주로 이 패키지가 다른 프로젝트의 의존성으로 설치될 때 의미가 있어요. 라이브러리를 배포할 때 쓰는 필드라고 보면 됩니다.

팀 안에서 개발 환경을 맞추고 싶다면 `devEngines`가 목적에 더 맞습니다. 이 필드는 `install`, `ci`, `run` 전에 검사하고, `onFail`을 적지 않으면 에러로 처리합니다.

```json
{
  "devEngines": {
    "runtime": {
      "name": "node",
      "version": ">=24",
      "onFail": "error"
    },
    "packageManager": {
      "name": "npm",
      "onFail": "error"
    }
  }
}
```

비교적 최근에 생긴 필드라서, 팀이 쓰는 npm 버전이 지원하는지 먼저 확인해 보시길 권합니다.

## 패키지 매니저와 corepack

npm, pnpm, Yarn이 섞이면 lockfile 자체가 달라집니다. 한 명은 `pnpm-lock.yaml`, 한 명은 `package-lock.json`을 만들면 곤란하죠.

이럴 때 `packageManager` 필드와 Corepack을 같이 씁니다.

```json
{
  "packageManager": "pnpm@9.15.0"
}
```

Corepack은 이 필드를 보고 정해진 버전의 pnpm이나 Yarn을 대신 실행해 줍니다. 버전 뒤에 해시를 붙여 검증할 수도 있어요.

다만 상태가 조금 복잡합니다. Corepack 공식 문서에 따르면 Node.js 14.19.0부터 25.0.0 이전까지만 기본으로 함께 배포됩니다. Node.js 문서에서도 실험적 기능으로 표시돼 있고, v25부터는 빠진다고 안내하고 있어요. 그 이후 버전에서는 `npm install -g corepack`으로 따로 설치해야 합니다.

```bash
# Node 25 이상이라면 먼저 설치
npm install -g corepack

corepack enable
```

lockfile은 커밋하고, CI와 배포에서는 `npm ci`를 쓰고, Node 버전은 `.nvmrc` 같은 파일 하나로 정해 CI도 그 파일을 읽게 하고, 팀의 도구 버전은 `devEngines`나 `packageManager`로 적어 둡니다. "제 컴퓨터에선 되는데요"는 "제 환경에선 되는데요"라는 뜻이었던 것 같습니다. 환경을 파일로 남겨 두면 그 말을 할 일이 확실히 줄어듭니다.

## 참고

- [npm ci | npm Docs](https://docs.npmjs.com/cli/v11/commands/npm-ci)
- [package-lock.json | npm Docs](https://docs.npmjs.com/cli/v11/configuring-npm/package-lock-json)
- [package.json (engines, devEngines) | npm Docs](https://docs.npmjs.com/cli/v11/configuring-npm/package-json)
- [config (engine-strict) | npm Docs](https://docs.npmjs.com/cli/v11/using-npm/config)
- [nvm README (.nvmrc)](https://github.com/nvm-sh/nvm#nvmrc)
- [actions/setup-node](https://github.com/actions/setup-node)
- [Corepack | Node.js Documentation](https://nodejs.org/docs/latest-v24.x/api/corepack.html)
- [nodejs/corepack](https://github.com/nodejs/corepack)
