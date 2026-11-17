---
title: pokebattle-engine
role: 1인 개발
kind: personal
order: 8
tags: [TypeScript, Pokémon Showdown, tsup, Vitest]
summary: Pokémon Showdown 시뮬레이터 기반 포켓몬 전투 엔진.
cover: img/projects/pokebattle-engine.png
link: https://github.com/2rangs/pokebattle-engine
demo: /portfolio/pokebattle-engine/
---

## 개요

포켓몬 전투 규칙을 TypeScript로 옮긴 전투 엔진 라이브러리입니다. 같은 게임 데이터를 다룬 [Pokestra](/projects/pokestra/)와 짝을 이루는 개인 프로젝트입니다.

## 한 일

- TypeScript 기반 전투 엔진 설계
- Pokémon Showdown 시뮬레이터를 감싸 PokeAPI 이름으로 팀·행동을 다루고, 프로토콜 로그를 타입이 있는 이벤트와 한국어 로그로 변환
- PokeAPI 포켓몬 1,351개(폼 포함)를 Showdown 데이터와 연결, @smogon/calc 기반 데미지 계산
- 시드로 재현 가능한 대량 퍼징 테스트: 이벤트만으로 다시 계산한 HP가 시뮬레이터와 일치하는지 등 7가지 불변식 검사
- tsup으로 ESM·CJS 빌드, React 훅 제공
