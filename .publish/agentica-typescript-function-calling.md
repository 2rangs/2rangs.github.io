
LLM에게 날씨 조회나 상품 검색 같은 실제 작업을 맡기려면, 호출할 수 있는 함수의 이름·설명·매개변수를 JSON 스키마로 알려 줘야 한다. 이 스키마를 손으로 관리하다 보면 코드와 스키마가 금세 어긋난다. 매개변수 하나를 추가하고 스키마 고치는 걸 잊으면 LLM은 옛 스키마대로 잘못된 인자를 넣어 호출한다. [Agentica](https://github.com/wrtnlabs/agentica)는 이 문제를 TypeScript 타입으로 풀려는 오픈소스 라이브러리로, 함수 시그니처와 주석에서 스키마를 자동으로 만들어 LLM에 연결해 준다.

코드와 API는 작성 당시(2025년 3월) 버전 기준이다. 이후 바뀌었을 수 있으니 실제로 적용할 때는 공식 저장소의 최신 문서를 확인하길 권한다.

## LLM Function Calling

Function Calling은 LLM이 외부 데이터에 접근하거나 특정 동작을 수행할 수 있게 하는 방식이다. 예를 들어 "오늘 날씨 어때?"라는 질문을 받으면, LLM은 직접 답을 지어내는 대신 날씨 조회 함수를 호출하겠다는 요청과 인자를 돌려준다. 애플리케이션이 그 함수를 실제로 실행하고 결과를 다시 LLM에 넘기면, LLM이 결과를 바탕으로 답변을 완성한다.

LLM은 함수를 직접 실행하지 않는다. LLM이 하는 일은 **어떤 함수를 어떤 인자로 호출할지 고르는 것**이고, 그 판단의 근거가 함수 스키마다.

```json
{
  "name": "getWeather",
  "description": "지정한 도시의 오늘 날씨를 조회한다.",
  "parameters": {
    "type": "object",
    "properties": {
      "city": { "type": "string", "description": "도시 이름" }
    },
    "required": ["city"]
  }
}
```

함수가 몇 개뿐이면 직접 써도 되지만, 수십 개로 늘어나고 매개변수 구조가 바뀔 때마다 스키마를 함께 고쳐야 한다면 유지보수 부담이 커진다. 스키마가 틀리면 LLM은 잘못된 인자로 함수를 호출한다.

## Agentica의 접근 방식

Agentica는 스키마를 사람이 쓰는 대신 TypeScript 컴파일러가 만들게 한다. 이 일을 맡는 것이 같은 팀이 만든 [Typia](https://typia.io/)다. Typia는 TypeScript 컴파일러 플러그인(트랜스포머)으로 동작해서, `typia.llm.application<클래스, 모델>()`을 호출하면 빌드 과정에서 클래스의 메서드 타입을 분석해 Function Calling 스키마로 바꿔 넣는다. 타입에서 스키마가 나오니 둘이 어긋날 일이 없다.

메서드와 속성에 단 JSDoc 주석은 스키마의 `description`으로 들어간다. LLM은 이 설명을 읽고 어떤 함수를 언제 호출할지 판단하므로, 주석을 잘 쓰는 일이 프롬프트를 잘 쓰는 일과 같다.

LLM이 타입에 맞지 않는 인자를 만들어 내는 경우도 있다. Agentica는 Typia의 런타임 검증으로 인자를 확인하고, 틀렸다면 어떤 부분이 틀렸는지 LLM에 알려 다시 생성하게 한다. TypeScript 클래스뿐 아니라 OpenAPI(Swagger) 문서로 정의된 HTTP API도 컨트롤러로 연결할 수 있고, 데코레이터나 별도의 설정 파일 없이 평범한 클래스와 타입, 주석만으로 동작한다.

## 설치와 설정

### 프로젝트 초기화

```bash
mkdir agentica-test && cd agentica-test

npm init -y
npm i -D typescript
npx tsc --init

npm i @agentica/core openai typia
```

OpenAI SDK의 패키지 이름은 `openai`다.

### Typia 설정

Typia는 컴파일 단계에서 코드를 변환하므로 TypeScript 컴파일러에 플러그인을 연결해야 한다. 설정 마법사가 필요한 의존성 설치와 `tsconfig.json` 수정을 대신해 준다.

```bash
npx typia setup
```

이후 `tsc`로 빌드하면 `typia.llm.application<...>()` 호출 자리에 생성된 스키마가 들어간다. 트랜스포머가 적용되지 않은 채로 실행하면 Typia 함수가 에러를 내므로, 빌드 결과물을 실행하거나 트랜스포머를 지원하는 실행 도구를 써야 한다.

API 키는 코드에 직접 쓰지 말고 환경 변수로 넘긴다.

```bash
export OPENAI_API_KEY="..."
```

## 기본 사용법

### LLM 연결

컨트롤러 없이 Agentica 인스턴스를 만들면 일반 챗봇처럼 동작한다.

```ts
import { Agentica } from "@agentica/core";
import OpenAI from "openai";

const agent = new Agentica({
  model: "chatgpt",
  vendor: {
    model: "gpt-4o-mini",
    api: new OpenAI({ apiKey: process.env.OPENAI_API_KEY }),
  },
  controllers: [],
});

const histories = await agent.conversate("안녕");
console.log(histories);
```

`model`은 스키마를 어떤 LLM 벤더 형식으로 만들지를, `vendor.model`은 실제로 호출할 모델 이름을 뜻한다. `conversate`는 이번 대화에서 생긴 기록(사용자 메시지, 어시스턴트 응답, 함수 호출 등)을 배열로 돌려준다. 최상위 `await`를 쓰려면 ESM 환경이어야 하며, CommonJS라면 `async` 함수로 감싸면 된다.

### 함수 연결

날씨를 조회하는 클래스를 만들어 컨트롤러로 등록해 보자.

```ts
import { Agentica } from "@agentica/core";
import OpenAI from "openai";
import typia from "typia";

class WeatherService {
  /**
   * 지정한 도시의 오늘 날씨를 조회한다.
   *
   * 사용자가 날씨를 물어볼 때 호출한다.
   */
  getWeather(props: {
    /** 날씨를 조회할 도시 이름 */
    city: string;
  }): { city: string; weather: string } {
    return { city: props.city, weather: "맑음" };
  }
}

const agent = new Agentica({
  model: "chatgpt",
  vendor: {
    model: "gpt-4o-mini",
    api: new OpenAI({ apiKey: process.env.OPENAI_API_KEY }),
  },
  controllers: [
    {
      protocol: "class",
      name: "weather",
      application: typia.llm.application<WeatherService, "chatgpt">(),
      execute: new WeatherService(),
    },
  ],
});

await agent.conversate("서울 날씨 어때?");
```

`protocol: "class"`는 TypeScript 클래스 인스턴스를 실행 대상으로 쓴다는 뜻이고, `execute`에 넘긴 인스턴스의 메서드가 실제로 호출된다. 매개변수는 `props` 객체 하나로 받는다. LLM Function Calling의 인자는 이름 붙은 속성이 있는 객체로 전달되므로, 객체 하나로 묶어야 스키마와 가장 자연스럽게 맞는다. 메서드 위의 주석과 속성 위의 주석은 각각 함수 설명과 매개변수 설명이 된다. 실제 서비스라면 반환값에 하드코딩된 문자열 대신 날씨 API 호출 결과를 넣으면 된다.

이제 사용자가 날씨를 물으면, LLM이 `getWeather`를 `{ city: "서울" }` 인자로 호출하도록 고르고 Agentica가 이를 실행한 뒤 결과를 바탕으로 답변을 만든다. "어떤 기능을 쓸 수 있어?"라고 물으면 등록된 함수 설명을 근거로 답한다.

### 여러 컨트롤러 등록

컨트롤러는 여러 개를 함께 등록할 수 있다. LLM은 대화 맥락에 따라 필요한 함수를 골라 호출한다.

```ts
class NewsService {
  /**
   * 주제와 관련된 최신 뉴스 제목을 조회한다.
   */
  getHeadlines(props: {
    /** 검색할 뉴스 주제 */
    topic: string;
  }): string[] {
    return [`${props.topic} 관련 뉴스 1`, `${props.topic} 관련 뉴스 2`];
  }
}

const agent = new Agentica({
  model: "chatgpt",
  vendor: {
    model: "gpt-4o-mini",
    api: new OpenAI({ apiKey: process.env.OPENAI_API_KEY }),
  },
  controllers: [
    {
      protocol: "class",
      name: "weather",
      application: typia.llm.application<WeatherService, "chatgpt">(),
      execute: new WeatherService(),
    },
    {
      protocol: "class",
      name: "news",
      application: typia.llm.application<NewsService, "chatgpt">(),
      execute: new NewsService(),
    },
  ],
});

await agent.conversate("서울 날씨랑 오늘 IT 뉴스 알려줘");
```

함수가 많아질수록 LLM이 올바른 함수를 고르는 정확도가 중요해진다. 함수 이름을 의도가 드러나게 짓고, 비슷한 함수끼리 언제 무엇을 써야 하는지 주석에 분명히 적어 둔다.

## 참고

- [Agentica GitHub 저장소](https://github.com/wrtnlabs/agentica)
- [Typia 공식 문서](https://typia.io/)
- [OpenAI Function Calling 가이드](https://platform.openai.com/docs/guides/function-calling)
