// 첫 화면 전체 배경: 은하수가 흐르는 밤하늘. 별자리는 왼쪽 메뉴(ConstellationNav)가 맡는다. 글 읽기에 방해되지 않게 옅게 깐다.
// 외부 이미지 없이 코드로 그린다. 씨앗값이 고정이라 빌드 때 HTML과 브라우저 화면이 같다.
// 별과 선은 currentColor. 테마별 투명도는 CSS에서 정한다.
function random(seed: number) {
  let value = seed
  return () => {
    value = (value * 1664525 + 1013904223) % 4294967296
    return value / 4294967296
  }
}

const W = 1440
const H = 900

const nextStar = random(2026)
const STARS = Array.from({ length: 380 }, () => {
  const size = nextStar()
  return { x: nextStar() * W, y: nextStar() * H * 0.86, r: size > 0.97 ? 1.6 : size > 0.85 ? 1.05 : 0.6, o: 0.3 + nextStar() * 0.7 }
})

// 은하수: 오른쪽 위에서 왼쪽 아래로 흐르는 띠. 띠를 따라 작은 별을 촘촘히 더 뿌린다.
const BAND = { x1: W + 60, y1: -60, x2: -80, y2: H * 0.82, width: 280 }
const BAND_LEN = Math.hypot(BAND.x2 - BAND.x1, BAND.y2 - BAND.y1)
const BAND_ANGLE = (Math.atan2(BAND.y2 - BAND.y1, BAND.x2 - BAND.x1) * 180) / Math.PI
const BAND_CX = (BAND.x1 + BAND.x2) / 2
const BAND_CY = (BAND.y1 + BAND.y2) / 2
const nextBand = random(77)
const BAND_STARS = Array.from({ length: 520 }, () => {
  const t = nextBand()
  const offset = (nextBand() + nextBand() + nextBand() - 1.5) * BAND.width * 0.55
  const nx = -(BAND.y2 - BAND.y1) / BAND_LEN
  const ny = (BAND.x2 - BAND.x1) / BAND_LEN
  return {
    x: BAND.x1 + (BAND.x2 - BAND.x1) * t + nx * offset,
    y: BAND.y1 + (BAND.y2 - BAND.y1) * t + ny * offset,
    r: nextBand() > 0.93 ? 0.9 : 0.45,
    o: 0.25 + nextBand() * 0.6,
  }
})



export function NightSky({ className = 'night-sky' }: { className?: string }) {
  return (
    <svg className={className} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id="milky-way">
          <stop offset="0" stopColor="currentColor" stopOpacity="0.55" />
          <stop offset="0.45" stopColor="currentColor" stopOpacity="0.18" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0" />
        </radialGradient>
      </defs>
      <g className="sky-milky-way">
        <ellipse cx={BAND_CX} cy={BAND_CY} rx={BAND_LEN / 2} ry={BAND.width / 2} fill="url(#milky-way)" transform={`rotate(${BAND_ANGLE.toFixed(1)} ${BAND_CX.toFixed(1)} ${BAND_CY.toFixed(1)})`} />
        {BAND_STARS.map((star, i) => <circle key={i} cx={star.x.toFixed(1)} cy={star.y.toFixed(1)} r={star.r} fill="currentColor" opacity={star.o.toFixed(2)} />)}
      </g>
      <g className="sky-stars">
        {STARS.map((star, i) => <circle key={i} cx={star.x.toFixed(1)} cy={star.y.toFixed(1)} r={star.r} fill="currentColor" opacity={star.o.toFixed(2)} />)}
      </g>
    </svg>
  )
}
