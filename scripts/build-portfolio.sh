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

ENGINE_TGZ=""
if [ -d "$SRC/pokebattle-engine" ]; then
  (
    set -e
    cd "$SRC/pokebattle-engine"
    npm ci --no-audit --no-fund
    npm pack --silent --pack-destination "$SRC" >/dev/null
    if [ -d playground ]; then
      cd playground
      npm ci --no-audit --no-fund
      npx vite build --base=/portfolio/pokebattle-engine/ --outDir "$OUT/pokebattle-engine" --emptyOutDir
    fi
  ) || warn "pokebattle-engine 빌드 실패"
  ENGINE_TGZ="$(ls "$SRC"/kyasi-pokebattle-engine-*.tgz 2>/dev/null | head -1)"
fi

if [ -d "$SRC/Pokestra" ]; then
  (
    set -e
    cd "$SRC/Pokestra"
    npm ci --no-audit --no-fund || npm install --no-audit --no-fund
    # 엔진은 같은 빌드에서 만든 패키지를 쓴다 (깃 의존성 커밋과 무관하게 일치)
    if [ -n "$ENGINE_TGZ" ] && grep -q '@kyasi/pokebattle-engine' package.json; then
      npm install --no-save --no-audit --no-fund "$ENGINE_TGZ"
    fi
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
