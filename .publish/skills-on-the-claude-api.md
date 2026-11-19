
[4편](/blog/claude-code-skills-in-practice/)에서는 Claude Code에서 폴더에 SKILL.md를 두는 것만으로 스킬을 썼다. API는 다르다. 스킬을 서버에 올리고, 요청마다 어떤 스킬을 쓸지 지정하고, 스킬이 만든 파일은 따로 내려받아야 한다. [지난 편](/blog/skills-with-scripts/)에서 만든 스크립트가 든 스킬도 API에서는 정해진 실행 환경 안에서만 실행된다.

이 글은 공식 문서 "Using Agent Skills with the API"와 Agent Skills 개요 문서를 기준으로, 2026년 6월에 확인한 내용을 TypeScript(`@anthropic-ai/sdk`) 예제로 정리한다. 예제 코드는 문서의 TypeScript 예제를 그대로 따랐다.

## 구조 한눈에 보기

API에서 스킬은 code execution 도구 위에서 실행된다. 문서는 사전 제작 스킬이든 직접 올린 스킬이든 붙이는 방식이 같다고 설명한다. 두 가지만 기억하면 된다.

- 요청의 `container.skills`에 쓸 스킬을 나열한다. 항목마다 `type`, `skill_id`, 선택값 `version`을 넣는다.
- `tools`에 code execution 도구를 넣는다. 스킬은 이 도구의 컨테이너 안에서 실행된다.

스킬의 출처는 둘이다.

| 구분 | Anthropic 스킬 | 사용자 스킬 |
| --- | --- | --- |
| `type` | `anthropic` | `custom` |
| `skill_id` | `pptx`, `xlsx`, `docx`, `pdf` | `skill_01...` 형식의 생성 ID |
| `version` | `20251013` 같은 날짜 또는 `latest` | `skver_01...` 형식의 버전 ID 또는 `latest` |
| 범위 | 모든 사용자 | 내 워크스페이스 |

문서 기준으로 요청당 스킬은 최대 20개까지 붙일 수 있다. 붙인 스킬은 [점진적 공개](/blog/skills-progressive-disclosure/) 방식으로 로드된다. 이름과 설명이 시스템 프롬프트에 들어가고, 스킬 파일은 컨테이너의 `/skills/{skill-name}/`에 복사된다. 디렉터리 이름은 `skill_01...` ID가 아니라 스킬 이름이다. 전체 지시문은 필요할 때만 읽힌다.

## 사전 제작 스킬 쓰기

가장 단순한 예는 PowerPoint 스킬이다.

```ts
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const response = await client.messages.create({
  model: "claude-opus-5-5",
  max_tokens: 4096,
  container: {
    skills: [
      {
        type: "anthropic",
        skill_id: "pptx",
        version: "latest"
      }
    ]
  },
  messages: [
    {
      role: "user",
      content: "Create a presentation about renewable energy"
    }
  ],
  tools: [
    {
      type: "code_execution_20250825",
      name: "code_execution"
    }
  ]
});
```

개요 문서에 따르면 사전 제작 스킬은 PowerPoint(`pptx`), Excel(`xlsx`), Word(`docx`), PDF(`pdf`) 네 가지다. Claude Code에서는 이 문서 스킬을 쓸 수 없다는 내용도 함께 적혀 있다.

## 생성된 파일 내려받기

스킬이 문서를 만들면 응답에는 파일 자체가 아니라 `file_id`가 담긴다. 문서에 따르면 이 ID는 code execution 도구 결과 블록 안에 있고, 파일은 Files API로 내려받는다.

```ts
import Anthropic from "@anthropic-ai/sdk";
import { writeFile } from "node:fs/promises";

const client = new Anthropic();

// 1. 스킬로 파일 만들기
const response = await client.messages.create({
  model: "claude-opus-5-5",
  max_tokens: 4096,
  container: {
    skills: [{ type: "anthropic", skill_id: "xlsx", version: "latest" }]
  },
  messages: [
    {
      role: "user",
      content: "Create an Excel file with a simple budget spreadsheet"
    }
  ],
  tools: [{ type: "code_execution_20250825", name: "code_execution" }]
});

// 2. 응답에서 file_id 모으기
const fileIds: string[] = [];
for (const block of response.content) {
  if (
    block.type === "bash_code_execution_tool_result" &&
    block.content.type === "bash_code_execution_result"
  ) {
    for (const outputBlock of block.content.content) {
      fileIds.push(outputBlock.file_id);
    }
  }
}

// 3. Files API로 내려받아 저장
for (const fileId of fileIds) {
  const fileMetadata = await client.files.retrieveMetadata(fileId);
  const fileResponse = await client.files.download(fileId);

  await writeFile(fileMetadata.filename, Buffer.from(await fileResponse.arrayBuffer()));
  console.log(`Downloaded: ${fileMetadata.filename}`);
}
```

반대로 스킬에 입력 파일을 주려면 `client.files.upload`로 먼저 올리고, 메시지 `content`에 `{ type: "container_upload", file_id: fileObject.id }` 블록을 텍스트와 함께 넣는다. 파일은 code execution 컨테이너 안으로 들어간다.

## 직접 만든 스킬 올리기

사용자 스킬은 Skills API(`/v1/skills`)로 올린다. SDK에서는 `client.skills`다. zip 하나로 올려도 되고 파일을 하나씩 올려도 된다. 파일은 첨부할 때 붙인 이름으로 식별된다.

```ts
import Anthropic, { toFile } from "@anthropic-ai/sdk";
import fs from "node:fs";

const client = new Anthropic();

// 파일을 하나씩 올리기 (zip 하나를 toFile로 넘겨도 된다)
const skill = await client.skills.create({
  files: [
    await toFile(fs.createReadStream("financial_skill/SKILL.md"), "financial_skill/SKILL.md", {
      type: "text/markdown"
    }),
    await toFile(
      fs.createReadStream("financial_skill/analyze.py"),
      "financial_skill/analyze.py",
      { type: "text/x-python" }
    )
  ]
});

console.log(`Created skill: ${skill.id}`);
console.log(`Latest version: ${skill.latest_version_id}`);
```

문서의 업로드 요건은 다음과 같다.

- `SKILL.md`가 업로드 루트에, 또는 하나뿐인 최상위 폴더 바로 아래에 있어야 한다.
- 전체 크기는 압축을 푼 기준 30MB 미만이다.
- `name`은 64자 이하, 소문자·숫자·하이픈만, XML 태그와 예약어(`anthropic`, `claude`) 불가. `description`은 비어 있지 않은 1,024자 이하이며 XML 태그 불가.
- `display_name`은 선택이다. 생략하면 SKILL.md의 `name`에서 가져온다.

프론트매터에도 주의할 점이 있다. Claude Code 문서는 claude.ai 업로드와 Skills API에서 쓸 수 있는 필드가 `name`, `description`, `license`, `compatibility`, `metadata`, `allowed-tools` 여섯 개이고, 그 밖의 필드가 있으면 업로드가 오류로 실패한다고 적는다. `disable-model-invocation` 같은 Claude Code 전용 필드를 쓰던 스킬은 API에 올리기 전에 정리해야 한다.

목록 조회는 `for await (const skill of client.skills.list())`로 하고, `source: "custom"`으로 사용자 스킬만 거를 수 있다. `client.skills.retrieve(id)`로 조회하고 `client.skills.delete(id)`로 지운다. 문서 기준으로 스킬을 지우면 모든 버전이 함께 지워진다.

## 버전 관리

스킬 파일을 고치면 새 버전을 만든다. 문서는 새 버전이 변경분이 아니라 **전체 스냅샷**이라고 강조한다. 매번 전체 파일을 올려야 하고, 빠진 파일은 이어지지 않는다. 새 버전 SKILL.md의 `name`은 기존 스킬 이름과 같아야 한다.

```ts
import Anthropic from "@anthropic-ai/sdk";
import fs from "node:fs";

const client = new Anthropic();

const newVersion = await client.skills.versions.create("skill_01AbCdEfGhIjKlMnOpQrStUv", {
  files: [fs.createReadStream("financial_skill.zip")]
});

// 운영 환경에서는 버전을 고정한다
const container: Anthropic.ContainerParams = {
  skills: [
    {
      type: "custom",
      skill_id: "skill_01AbCdEfGhIjKlMnOpQrStUv",
      version: newVersion.id
    }
  ]
};
```

문서는 운영에서는 특정 버전을 고정하고, 개발 중에는 `latest`를 쓰라고 권한다. `version`을 빼거나 `latest`로 두면 워크스페이스의 누군가가 새 버전을 올리는 순간 운영 에이전트의 동작이 바뀐다. 버전 ID는 숫자처럼 보여도 항상 문자열이다. 팀에서 디자인 시스템 패키지를 semver로 고정하듯 스킬도 고정한다고 생각하면 된다.

## 여러 턴과 오래 걸리는 작업

응답의 `container`에는 컨테이너 `id`가 있다. 다음 요청에 같은 ID를 넘기면 컨테이너를 이어 쓸 수 있고, 앞서 만든 파일도 남아 있다. 스킬이 오래 걸리는 작업을 하면 `stop_reason`이 `pause_turn`으로 올 수 있다. 문서 예제는 응답을 그대로 이어 붙여 다시 요청한다.

```ts
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();
const messages: Anthropic.MessageParam[] = [
  { role: "user", content: "Generate and process a large sample dataset" }
];
const maxRetries = 10;

let response = await client.messages.create({
  model: "claude-opus-5-5",
  max_tokens: 4096,
  container: {
    skills: [{ type: "custom", skill_id: "skill_01AbCdEfGhIjKlMnOpQrStUv", version: "latest" }]
  },
  messages,
  tools: [{ type: "code_execution_20250825", name: "code_execution" }]
});

for (let i = 0; i < maxRetries; i++) {
  if (response.stop_reason !== "pause_turn") {
    break;
  }

  messages.push({
    role: "assistant",
    content: response.content as Anthropic.ContentBlockParam[]
  });
  response = await client.messages.create({
    model: "claude-opus-5-5",
    max_tokens: 4096,
    container: {
      id: response.container!.id,
      skills: [
        { type: "custom", skill_id: "skill_01AbCdEfGhIjKlMnOpQrStUv", version: "latest" }
      ]
    },
    messages,
    tools: [{ type: "code_execution_20250825", name: "code_execution" }]
  });
}
```

문서는 이어서 요청할 때 컨테이너 ID를 스킬 목록과 같은 `container` 객체에 넣으라고 한다. 빠뜨리면 새 컨테이너에서 실행되어 앞서 만든 파일을 잃는다.

## 운영 전에 확인할 것

- **워크스페이스 범위**: 사용자 스킬은 최종 사용자나 세션 단위가 아니라 워크스페이스 전체에 공개된다. 워크스페이스에 접근할 수 있는 API 키는 모든 사용자 스킬을 읽고, 사용하고, 지울 수 있다. 분리해야 하는 스킬은 별도 워크스페이스에 둔다.
- **실행 환경**: 네트워크 접근이 없고 실행 중 패키지 설치도 안 된다. 스크립트는 미리 설치된 라이브러리만으로 실행되어야 한다.
- **프롬프트 캐싱**: 스킬 목록이 바뀌면 캐시가 깨진다. 목록과 순서를 요청마다 같게 유지한다.
- **필요한 스킬만**: 문서는 쓰지 않는 스킬을 붙이면 성능에 영향을 준다고 한다.
- **오류 처리**: 스킬 문제로 실패한 요청은 HTTP 400을 돌려준다. SDK에서는 `Anthropic.BadRequestError`로 잡는다.
- **데이터 보존**: 개요 문서 기준으로 Agent Skills는 ZDR 대상이 아니다.

> **참고** 문서에는 이전 베타 헤더 `skills-2025-10-02`에서 옮기는 방법이 따로 정리되어 있다. 확인 시점 문서 기준으로 Skills API는 베타 헤더 없이 `client.skills`로 쓰며, 응답 필드 이름(`display_name`, `latest_version_id` 등)이 베타 때와 다르다. 예전 코드를 옮길 때는 이 표부터 본다.

## 정리

- API에서 스킬은 `container.skills`로 지정하고 code execution 도구를 함께 넣는다.
- 사전 제작 스킬은 `type: "anthropic"`과 `pptx`/`xlsx`/`docx`/`pdf`, 사용자 스킬은 `type: "custom"`과 생성된 ID로 붙인다.
- 생성된 파일은 응답의 `file_id`로 Files API에서 내려받고, 입력 파일은 `container_upload`로 넣는다.
- 사용자 스킬은 `client.skills.create`로 올리고, 새 버전은 매번 전체 파일로 만든다. 운영에서는 버전을 고정한다.
- 여러 턴과 `pause_turn`에서는 컨테이너 ID를 이어 넘긴다.

다음 편에서는 프론트엔드 팀의 [디자인 시스템 규칙을 스킬로 옮기는](/blog/design-system-skill/) 실전 예시를 처음부터 끝까지 만든다.

## 참고

- https://platform.claude.com/docs/en/build-with-claude/skills-guide
- https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview
- https://platform.claude.com/docs/en/agents-and-tools/tool-use/code-execution-tool
- https://platform.claude.com/docs/en/build-with-claude/files
- https://code.claude.com/docs/en/skills
