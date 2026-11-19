
지금까지는 [SKILL.md 쓰는 법](/blog/writing-skill-md/), [점진적 공개](/blog/skills-progressive-disclosure/), [Claude Code에서 스킬 쓰기](/blog/claude-code-skills-in-practice/)처럼 모두 텍스트로 쓰는 지시에 관한 이야기였다. 이번에는 스킬 폴더에 실행 가능한 코드를 넣는다.

프론트엔드 팀에는 매번 같은 방식으로, 틀리지 않게 해야 하는 일이 많다. 디자인 토큰 형식 검사, 아이콘 파일 이름 규칙 확인 같은 것들이다. 이런 일을 Claude가 매번 코드를 새로 짜서 처리하면 결과가 조금씩 달라진다. 스크립트를 넣으면 이 부분을 고정할 수 있다. 2026년 5월 기준으로 공식 문서에서 확인한 내용이다.

## 스크립트를 쓰는 이유

Anthropic 엔지니어링 블로그는 어떤 작업은 토큰 생성보다 전통적인 코드가 낫다고 설명한다. 목록 정렬을 예로 들며, 많은 작업에는 코드로만 얻을 수 있는 결정적인 신뢰성이 필요하다고 말한다.

공식 개요 문서의 동작 방식도 같은 방향이다. 스킬의 스크립트는 Claude가 bash로 실행하고, **스크립트 코드 자체는 컨텍스트에 들어가지 않는다.** 들어가는 것은 실행 결과뿐이다. 작성 모범 사례 문서는 미리 만든 스크립트의 장점으로 생성한 코드보다 믿을 수 있고, 토큰과 시간을 아끼고, 매번 같은 결과를 낸다는 점을 든다.

## 얼마나 고정할지 먼저 정한다

모든 일을 스크립트로 만들 필요는 없다. 모범 사례 문서는 작업이 얼마나 깨지기 쉬운지에 맞춰 지시의 구체성을 정하라고 하며 세 단계로 나눈다.

- **높은 자유도**: 글로 된 지시. 여러 접근이 모두 맞고 맥락에 따라 판단이 달라질 때. 코드 리뷰가 대표적이다.
- **중간 자유도**: 의사 코드나 매개변수가 있는 스크립트. 선호 패턴은 있지만 변형을 허용할 때.
- **낮은 자유도**: 매개변수가 거의 없는 특정 스크립트. 실수하기 쉽고 일관성이 중요하며 순서가 정해진 작업.

문서의 비유대로, 양쪽이 절벽인 좁은 다리에는 난간과 정확한 지시가, 넓은 들판에는 방향만 있으면 된다. 토큰 파일 검증은 좁은 다리다. 규칙이 명확하고, 틀리면 빌드나 디자인 QA에서 문제가 생긴다. "이 컴포넌트 API가 자연스러운가"는 들판이다.

## 예시: 디자인 토큰 검증 스킬

토큰을 `{"color.bg.surface": "#FFFFFF"}` 같은 평평한 JSON으로 관리한다고 하자. 바꿀 때마다 이름 규칙, 색 형식, 참조 대상의 존재를 확인한다.

```text
validating-design-tokens/
├── SKILL.md
└── scripts/
    └── validate_tokens.py
```

SKILL.md는 언제 무엇을 실행할지만 알려 준다.

````md
---
name: validating-design-tokens
description: Validates design token JSON files for naming rules, color formats, and broken references. Use when adding or changing design tokens, editing tokens/*.json, or when the user mentions tokens or theme values.
---

# Validating design tokens

1. Edit the token file.
2. Run the validator on every changed file:

   ```bash
   python3 scripts/validate_tokens.py tokens/color.json
   ```

3. If it prints errors, fix each one and run it again.
4. Report the change as done only after it prints `OK`.

Do not hand-check the rules. The script is the source of truth.
````

스크립트는 표준 라이브러리만 쓴다. 이유는 뒤에서 설명한다.

```python
#!/usr/bin/env python3
"""Validate a flat design token JSON file."""
import json, re, sys

NAME = re.compile(r"^[a-z0-9]+(\.[a-z0-9-]+)+$")
HEX = re.compile(r"^#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$")
REF = re.compile(r"^\{([a-z0-9.-]+)\}$")

def main(path):
    try:
        tokens = json.load(open(path, encoding="utf-8"))
    except FileNotFoundError:
        print(f"File not found: {path}. Pass a path such as tokens/color.json")
        return 2
    except json.JSONDecodeError as e:
        print(f"Invalid JSON in {path} at line {e.lineno}: {e.msg}")
        return 2

    errors = []
    for name, value in tokens.items():
        if not NAME.match(name):
            errors.append(f"Bad name '{name}'. Use dot-separated lowercase, e.g. color.bg.surface")
        ref = REF.match(str(value))
        if ref and ref.group(1) not in tokens:
            group = ref.group(1).rsplit(".", 1)[0]
            similar = [t for t in tokens if t.startswith(group)][:5]
            errors.append(f"'{name}' references missing '{ref.group(1)}'. Similar: {similar}")
        elif not ref and name.startswith("color.") and not HEX.match(str(value)):
            errors.append(f"'{name}' has invalid color '{value}'. Use #RRGGBB or #RRGGBBAA")

    print("\n".join(errors) if errors else "OK")
    return 1 if errors else 0

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: validate_tokens.py <token-file.json>")
        sys.exit(2)
    sys.exit(main(sys.argv[1]))
```

## 실행할지, 읽을지를 분명히 쓴다

모범 사례 문서는 지시문에서 스크립트를 **실행**할지 **참고 자료로 읽을지**를 분명히 하라고 강조한다. "`analyze_form.py`를 실행해 필드를 추출한다"와 "추출 알고리즘은 `analyze_form.py`를 본다"는 전혀 다른 행동을 끌어낸다. 대부분은 실행이 더 믿을 만하고 효율적이라고 문서는 덧붙인다. 예시의 "Do not hand-check the rules"도 판정을 스크립트에 맡긴다고 분명히 적은 문장이다.

스크립트 작성 원칙도 문서에 있다.

- **떠넘기지 말고 해결한다.** 예외를 그냥 던져 Claude가 수습하게 두지 않는다.
- **마법 숫자를 피한다.** 설정값에는 이유를 주석으로 남긴다.
- **오류 메시지를 구체적으로 쓴다.** 무엇이 없고 대신 무엇이 있는지 알려 주면 Claude가 바로 고친다. 예시에서 비슷한 토큰 이름을 함께 출력하는 것도 그래서다.
- **경로는 슬래시로 쓴다.** `scripts\helper.py` 같은 경로는 Unix 환경에서 오류를 낸다.

## 실행 환경과 의존성

같은 스킬도 어디서 실행하느냐에 따라 쓸 수 있는 것이 다르다. 개요 문서 기준으로 정리하면 이렇다.

- **Claude API**: 네트워크 접근이 없고 실행 중 패키지를 설치할 수 없다. 미리 설치된 패키지만 쓰며, 목록은 code execution 도구 문서에 있다.
- **claude.ai**: 사용자와 관리자 설정에 따라 네트워크 접근이 전부, 일부, 없음 중 하나다.
- **Claude Code**: 사용자 컴퓨터의 다른 프로그램과 같은 네트워크 접근을 가진다. 패키지는 전역이 아니라 로컬에만 설치하라고 권한다.

그래서 여러 곳에서 쓸 스킬은 의존성을 최소화하는 편이 안전하다. 외부 패키지가 꼭 필요하면 SKILL.md에 적고 대상 환경에서 쓸 수 있는지 확인한다. 모범 사례 문서도 패키지가 설치되어 있다고 가정하지 말라고 경고한다.

Claude Code에는 추가 장치가 있다. 문서에 따르면 `${CLAUDE_SKILL_DIR}`는 SKILL.md가 있는 디렉터리로 치환되어 작업 디렉터리와 상관없이 번들 스크립트를 가리킨다. `allowed-tools`는 스킬을 호출한 턴 동안 나열한 도구를 승인 없이 쓰게 한다. 문서 예시처럼 `allowed-tools: Bash(${CLAUDE_SKILL_DIR}/scripts/render.sh *)`로 두고 본문에서도 같은 경로를 쓰면, 그 스크립트는 권한 확인 없이 실행된다.

> **참고** 이런 Claude Code 전용 기능은 claude.ai 업로드나 API에서는 동작하지 않는다. 여러 환경에서 쓸 스킬이라면 `scripts/validate_tokens.py` 같은 상대 경로가 무난하다.

## 출력을 검증하는 루프

스크립트는 검증 루프에서 가장 쓸모가 크다. 모범 사례 문서가 권하는 기본 패턴은 "검증기 실행 → 오류 수정 → 반복"이고, 문서는 이 패턴이 출력 품질을 크게 높인다고 한다. 앞의 SKILL.md가 이 구조로, `OK`가 나오기 전에는 완료라고 보고하지 않는다.

여러 파일을 한 번에 바꾸면 한 단계를 더 둔다. 문서가 "계획-검증-실행"이라 부르는 패턴이다. Claude가 바꿀 내용을 `changes.json` 같은 파일로 먼저 쓰고, 스크립트로 그 계획을 검증한 뒤, 통과했을 때만 적용한다. 일괄 작업이나 되돌리기 어려운 변경에 맞는다. 토큰 이름 일괄 변경이라면 "변경 목록 작성 → 목록 검증 → 적용 → 전체 검증"이 된다. 흐름이 길면 체크리스트를 주고 Claude가 응답에 복사해 단계마다 지워 가게 한다. 검증 단계를 건너뛰는 일이 줄어든다.

코드가 들어가면 보안도 챙겨야 한다. 개요 문서는 직접 만들었거나 Anthropic에서 받은 스킬만 쓰라고 권하고, 출처가 불분명하면 스크립트를 포함한 모든 파일을 검토하라고 한다. 팀 저장소의 스킬이라면 스크립트 변경도 일반 코드처럼 리뷰를 거치게 한다.

## 정리

- 결정적이어야 하는 일과 복잡한 검증은 스크립트로 뺀다. 코드는 컨텍스트에 들어가지 않고 출력만 들어간다.
- 작업이 얼마나 깨지기 쉬운지에 따라 자유도를 정한다.
- 스크립트를 실행할지 읽을지 분명히 쓰고, 오류 메시지는 고칠 방법이 보이게 쓴다.
- API에는 네트워크와 런타임 설치가 없다. 여러 환경에서 쓸 스킬은 의존성을 줄인다.
- 검증 루프를 워크플로에 넣고, 통과 전에는 완료라고 보고하지 않게 한다.

다음 편에서는 이런 스킬을 [Claude API에서 쓰는 방법](/blog/skills-on-the-claude-api/)을 다룬다.

## 참고

- https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview
- https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices
- https://code.claude.com/docs/en/skills
- https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills
