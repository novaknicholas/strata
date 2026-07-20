'use client'

import { useEffect, useState } from 'react'
import type { GameMode } from '@/lib/types'

// ── Contour field for the title section — thin, slow, breathing ───────────
// Two clusters of concentric wobbled rings, split into two layers that
// breathe at different rates (see .eg-breathe-a / -b).
function contourRings(
  cx: number, cy: number, maxRx: number, maxRy: number,
  levels: number, wFreq: number, wAmp: number,
): string[] {
  const STEPS = 110
  const out: string[] = []
  for (let lvl = 1; lvl <= levels; lvl++) {
    const t = lvl / levels
    const rx = maxRx * t, ry = maxRy * t
    const phase = lvl * 0.63
    const pts: string[] = []
    for (let s = 0; s <= STEPS; s++) {
      const θ = (s / STEPS) * Math.PI * 2
      const wobble = 1 + wAmp * Math.sin(wFreq * θ + phase) + wAmp * 0.4 * Math.cos((wFreq + 2) * θ + phase * 0.7)
      pts.push(`${s === 0 ? 'M' : 'L'}${(cx + rx * wobble * Math.cos(θ)).toFixed(1)},${(cy + ry * wobble * Math.sin(θ)).toFixed(1)}`)
    }
    pts.push('Z')
    out.push(pts.join(' '))
  }
  return out
}

const RINGS_A = [
  ...contourRings(300, 210, 420, 235, 8, 4, 0.07),
  ...contourRings(1190, 300, 360, 205, 7, 3, 0.06),
]
const RINGS_B = [
  ...contourRings(760, 120, 330, 185, 6, 5, 0.08),
  ...contourRings(60, 430, 260, 150, 5, 3, 0.05),
]

interface Mode {
  key:   GameMode
  label: string
  desc:  string
  img:   string
  tag?:  string
}

const FEATURED: Mode[] = [
  { key: 'urban', label: 'Urban', desc: 'Cities & towns worldwide',  img: '/images/urban.jpg', tag: 'Most popular' },
  { key: 'terra', label: 'Terra', desc: 'Anywhere on Earth',         img: '/images/terra.jpg', tag: 'Featured' },
  { key: 'usa',   label: 'USA',   desc: 'Coast to coast',            img: '/images/usa.jpg',   tag: 'Popular' },
]

const REST: Mode[] = [
  { key: 'europe',    label: 'Europe',    desc: 'Towns & cities of Europe' , img: '/images/europe.jpg'    },
  { key: 'islands',   label: 'Islands',   desc: 'Reefs & remote shores'    , img: '/images/islands.jpg'   },
  { key: 'mountains', label: 'Mountains', desc: 'High peaks & glaciers'    , img: '/images/mountains.jpg' },
  { key: 'volcanoes', label: 'Volcanoes', desc: 'Active & dormant cones'   , img: '/images/volcanoes.jpg' },
  { key: 'uncharted', label: 'Uncharted', desc: 'Jungle, desert & wild'    , img: '/images/uncharted.jpg' },
  { key: 'airports',  label: 'Airports',  desc: 'Major hubs worldwide'     , img: '/images/airports.jpg'  },
  { key: 'landmarks', label: 'Landmarks', desc: 'Iconic sites & wonders'   , img: '/images/landmarks.jpg' },
]

const BEST_KEY = 'strata_best_score'

interface MainMenuProps {
  onPlay: (mode: GameMode) => void
}

export default function MainMenu({ onPlay }: MainMenuProps) {
  const [bestScore, setBestScore] = useState<number | null>(null)

  useEffect(() => {
    try {
      const stored = parseInt(localStorage.getItem(BEST_KEY) ?? '', 10)
      if (!isNaN(stored) && stored > 0) setBestScore(stored)
    } catch { /* storage blocked */ }
  }, [])

  const Tile = ({ mode, className = '', delay }: { mode: Mode; className?: string; delay: number }) => (
    <button
      type="button"
      className={`eg-tile eg-fade ${className}`}
      style={{ animationDelay: `${delay}s` }}
      aria-label={`Play ${mode.label} — ${mode.desc}`}
      onClick={() => onPlay(mode.key)}
    >
      <span className="eg-img" style={{ backgroundImage: `url(${mode.img})` }} />
      <span className="eg-shade" />
      {mode.tag && <span className="eg-tag">{mode.tag}</span>}
      <span className="eg-meta">
        <span className="eg-name">{mode.label}</span>
        <span className="eg-desc">{mode.desc}</span>
      </span>
    </button>
  )

  return (
    <div
      className="eg-root absolute inset-0 z-50 overflow-y-auto"
      style={{
        WebkitOverflowScrolling: 'touch' as never,
        overscrollBehavior:      'contain',
        animation:               'fadeIn 0.35s ease both',
      }}
    >
      <div
        className="relative"
        style={{
          minHeight:     '100%',
          maxWidth:      1040,
          margin:        '0 auto',
          paddingTop:    'calc(env(safe-area-inset-top, 0px) + 3.5rem)',
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 2.75rem)',
          paddingLeft:   'calc(env(safe-area-inset-left, 0px) + 1.4rem)',
          paddingRight:  'calc(env(safe-area-inset-right, 0px) + 1.4rem)',
        }}
      >
        {/* ── Title section — contours live here only ── */}
        <header className="relative" style={{ textAlign: 'center', marginBottom: 44, overflow: 'visible' }}>
          <svg
            aria-hidden
            className="eg-contours"
            viewBox="0 0 1440 560"
            preserveAspectRatio="xMidYMid slice"
            style={{ width: 'auto', height: 'auto' }}
          >
            <g className="eg-breathe-a" fill="none" stroke="#5A7050" strokeWidth="0.8" opacity="0.16">
              {RINGS_A.map((d, i) => <path key={i} d={d} />)}
            </g>
            <g className="eg-breathe-b" fill="none" stroke="#5A7050" strokeWidth="0.8" opacity="0.10">
              {RINGS_B.map((d, i) => <path key={i} d={d} />)}
            </g>
          </svg>

          <p className="eg-kicker eg-fade" style={{ margin: '0 0 18px', animationDelay: '0s', position: 'relative' }}>
            Explore our Earth
          </p>

          <h1
            className="eg-fade"
            style={{
              position: 'relative',
              fontFamily: 'var(--font-display), Georgia, serif',
              fontWeight: 800,
              fontSize: 'clamp(64px, 15vw, 132px)',
              lineHeight: 0.95,
              letterSpacing: '0.01em',
              color: 'var(--ink)',
              margin: '0 0 14px',
              animationDelay: '0.07s',
            }}
          >
            Strata
          </h1>

          <p
            className="eg-fade"
            style={{
              position: 'relative', fontSize: 16, color: 'var(--ink-soft)',
              margin: '0 0 30px', animationDelay: '0.15s',
            }}
          >
            Every corner of Earth. 30 seconds to find it.
          </p>

          <div className="eg-fade" style={{ position: 'relative', animationDelay: '0.22s' }}>
            <div className="eg-tabs">
              <button type="button" className="eg-tab eg-tab-active">Single Player</button>
              <button type="button" className="eg-tab" disabled>
                Multiplayer
                <span className="eg-soon">Soon</span>
              </button>
            </div>
          </div>
        </header>

        {/* ── Featured: Urban large + Terra / USA stacked ── */}
        <div className="eg-feature">
          <Tile mode={FEATURED[0]} className="eg-lead" delay={0.3} />
          <Tile mode={FEATURED[1]} delay={0.37} />
          <Tile mode={FEATURED[2]} delay={0.44} />
        </div>

        {/* ── The rest — wide editorial cards ── */}
        <div className="eg-rest">
          {REST.map((m, i) => (
            <Tile
              key={m.key}
              mode={m}
              className={i === REST.length - 1 ? 'eg-span2' : ''}
              delay={0.5 + i * 0.06}
            />
          ))}
        </div>

        {/* ── Footer — quiet best-score pill + credit ── */}
        <div style={{ marginTop: 36, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
          {bestScore !== null && (
            <span className="eg-best eg-fade" style={{ animationDelay: '0.9s' }}>
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden>
                <path d="M4 2h8v3a4 4 0 0 1-8 0V2Z" /><path d="M4 4H2v1a2 2 0 0 0 2 2M12 4h2v1a2 2 0 0 1-2 2M6 11h4M5.5 14h5M8 11v3" strokeLinecap="round" />
              </svg>
              Best {bestScore.toLocaleString()} / 30,000
            </span>
          )}
          <p style={{ fontSize: 10.5, letterSpacing: '0.06em', color: 'var(--ink-faint)', margin: 0 }}>
            Imagery © Mapbox · Maxar · NASA
          </p>
        </div>
      </div>
    </div>
  )
}
