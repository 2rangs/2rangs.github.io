import { useEffect, useState } from 'react'
import { AQR, AQR_LINES, CHAIN } from '../lib/aquarius'

// 첫 화면 전체 배경: 은하수가 흐르는 밤하늘. 별자리는 왼쪽 메뉴(ConstellationNav)가 맡는다. 글 읽기에 방해되지 않게 옅게 깐다.
// 외부 이미지 없이 코드로 그린다. 씨앗값이 고정이라 언제 그려도 같은 하늘이다.
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



// 좁은 화면에서는 별자리 메뉴가 없으므로, 다 켜진 물병자리를 배경의 일부로 그린다(넓은 화면에서는 CSS로 숨긴다).
// 세로 화면에서 보이는 가운데 영역(대략 x 520~920) 위쪽에 둔다.
const BG_X = 660
const BG_Y = 110
const BG_SCALE = 1.1
const BG_SEGMENTS = [...AQR_LINES, ...CHAIN.slice(1).map((star, i) => [CHAIN[i], star] as [number, number])]

type Star = { x: number; y: number; r: number; o: number }

// 별 900여 개를 <circle> 하나씩 그리면 HTML이 수십 KB가 되고 요소도 그만큼 늘어난다.
// 투명도를 몇 단계로 묶어, 단계마다 원 여러 개를 하나의 <path>로 그린다.
function starPaths(stars: Star[], steps = 6) {
  const groups = new Map<number, string[]>()
  for (const { x, y, r, o } of stars) {
    const level = Math.min(steps - 1, Math.floor(o * steps))
    const d = `M${(x - r).toFixed(1)} ${y.toFixed(1)}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`
    groups.set(level, [...(groups.get(level) ?? []), d])
  }
  return [...groups].map(([level, parts]) => ({ opacity: ((level + 0.5) / steps).toFixed(2), d: parts.join('') }))
}

const BAND_PATHS = starPaths(BAND_STARS)
const STAR_PATHS = starPaths(STARS)

export function NightSky({ className = 'night-sky' }: { className?: string }) {
  // 배경 별은 장식이라 첫 화면을 그린 뒤에 채운다. 빌드 때 HTML에는 넣지 않아 첫 화면이 가벼워진다.
  const [ready, setReady] = useState(false)
  useEffect(() => setReady(true), [])
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
        {ready && BAND_PATHS.map((path) => <path key={path.opacity} d={path.d} fill="currentColor" opacity={path.opacity} />)}
      </g>
      <g className="sky-stars">
        {ready && STAR_PATHS.map((path) => <path key={path.opacity} d={path.d} fill="currentColor" opacity={path.opacity} />)}
      </g>
      <g className="sky-aquarius" transform={`translate(${BG_X} ${BG_Y}) scale(${BG_SCALE})`}>
        {BG_SEGMENTS.map(([a, b]) => <line key={`${a}-${b}`} x1={AQR[a][0]} y1={AQR[a][1]} x2={AQR[b][0]} y2={AQR[b][1]} stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />)}
        {AQR.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={i === 0 || i === 12 ? 2.8 : 2.2} fill="currentColor" />)}
      </g>
    </svg>
  )
}
