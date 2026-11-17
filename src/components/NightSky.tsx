// 첫 화면 전체 배경: 은하수가 흐르는 밤하늘과 물병자리. 글 읽기에 방해되지 않게 옅게 깐다.
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

// 밝은 별에 붙이는 네 갈래 반짝임.
const sparkle = (x: number, y: number, size: number) =>
  `M${x} ${y - size} L${x + size * 0.14} ${y - size * 0.14} L${x + size} ${y} L${x + size * 0.14} ${y + size * 0.14} L${x} ${y + size} L${x - size * 0.14} ${y + size * 0.14} L${x - size} ${y} L${x - size * 0.14} ${y - size * 0.14} Z`

// 물병자리 밝은 별들의 대략적 상대 위치(별자리 모양은 천문 사실). 두 단 사이의 빈 곳에 둔다.
const SCALE = 0.85
const OX = 220
const OY = 235
const RAW: [number, number][] = [
  [318, 150], [228, 222], [156, 276], [226, 310], [284, 300],
  [148, 320], [132, 336], [120, 346],
  [186, 438], [198, 394], [250, 390], [266, 404], [304, 430],
]
const AQUARIUS = RAW.map(([x, y]) => [OX + x * SCALE, OY + y * SCALE] as [number, number])
const LINES: [number, number][] = [[0, 1], [1, 2], [2, 3], [3, 4], [2, 5], [5, 6], [6, 7], [7, 8], [8, 9], [9, 10], [10, 11], [11, 12]]
const BRIGHT = new Set([0, 1, 2, 7, 8, 12])


export function NightSky({ className = 'night-sky' }: { className?: string }) {
  return (
    <svg className={className} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id="star-glow">
          <stop offset="0" stopColor="currentColor" stopOpacity="0.9" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0" />
        </radialGradient>
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
      <g className="sky-constellation">
        {LINES.map(([a, b]) => (
          <line key={`${a}-${b}`} x1={AQUARIUS[a][0]} y1={AQUARIUS[a][1]} x2={AQUARIUS[b][0]} y2={AQUARIUS[b][1]} stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
        ))}
        {AQUARIUS.map(([x, y], i) => (
          <g key={i}>
            {BRIGHT.has(i) && <circle cx={x} cy={y} r="11" fill="url(#star-glow)" opacity="0.45" />}
            {BRIGHT.has(i) && <path d={sparkle(x, y, i === 1 ? 14 : 10)} fill="currentColor" />}
            <circle cx={x} cy={y} r={BRIGHT.has(i) ? 2.4 : 1.6} fill="currentColor" />
          </g>
        ))}
        <text x={OX + 236 * SCALE} y={OY + 100} textAnchor="middle" fill="currentColor" fontSize="14" fontWeight="600" letterSpacing="3">AQUARIUS</text>
      </g>
    </svg>
  )
}
