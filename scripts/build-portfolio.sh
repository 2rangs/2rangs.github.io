#!/usr/bin/env bash
# 개인 프로젝트 사이트를 블로그 빌드 결과(dist)의 /portfolio/<프로젝트>/ 아래에 넣는다.
#   https://2rangs.github.io/portfolio/pokestra/
#   https://2rangs.github.io/portfolio/pokebattle-engine/
# 프로젝트 저장소는 _portfolio/ 아래에 체크아웃되어 있어야 한다 (static.yml 참고).
# 한 프로젝트 빌드가 실패해도 블로그 배포는 계속한다.
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/dist/portfolio"
SRC="$ROOT/_portfolio"
mkdir -p "$OUT"

warn() { echo "::warning::$*"; }

if [ -d "$SRC/pokebattle-engine" ]; then
  (
    set -e
    cd "$SRC/pokebattle-engine"
    # npm ci가 prepare(tsup)로 dist를 만들고, 문서 사이트는 그 dist를 쓴다
    npm ci --no-audit --no-fund
    if [ -d playground ]; then
      cd playground
      npm ci --no-audit --no-fund
      npx vite build --base=/portfolio/pokebattle-engine/ --outDir "$OUT/pokebattle-engine" --emptyOutDir
    fi
  ) || warn "pokebattle-engine 빌드 실패"
fi

if [ -d "$SRC/Pokestra" ]; then
  (
    set -e
    cd "$SRC/Pokestra"
    # 잠금 파일에 고정된 버전만 설치한다. 실패해도 npm install로 최신 버전을 끌어오지 않는다.
    npm ci --no-audit --no-fund
    npx vite build --base=/portfolio/pokestra/ --outDir "$OUT/pokestra" --emptyOutDir
  ) || warn "Pokestra 빌드 실패"
fi

# /portfolio/ 자체는 포트폴리오 목록으로 보낸다
cat > "$OUT/index.html" <<'HTML'
<!doctype html>
<meta charset="utf-8">
<title>포트폴리오</title>
<meta http-equiv="refresh" content="0; url=/projects/">
<link rel="canonical" href="/projects/">
<a href="/projects/">포트폴리오로 이동</a>
HTML

ls "$OUT"
