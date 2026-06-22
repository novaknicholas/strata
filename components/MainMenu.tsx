'use client'

import { useEffect, useState } from 'react'
import type { GameMode } from '@/lib/types'

// ── Topographic contour brand texture ─────────────────────────────────────
const TOPO_PATHS: { d: string; index: boolean }[] = (() => {
  type Hill = [number, number, number, number, number, number, number]
  const hills: Hill[] = [
    [  300,  300, 470, 250, 9, 4, 0.07],
    [ 1180,  220, 360, 200, 7, 3, 0.06],
    [  760,  720, 440, 250, 8, 5, 0.08],
    [  130, 1060, 320, 190, 6, 4, 0.06],
    [ 1250, 1100, 410, 235, 7, 3, 0.07],
    [  560, 1520, 390, 220, 7, 4, 0.07],
    [ 1080, 1800, 340, 195, 6, 5, 0.06],
    [  -60,  720, 270, 160, 5, 3, 0.05],
    [ 1510,  960, 300, 170, 5, 4, 0.05],
  ]
  const STEPS = 120
  const out: { d: string; index: boolean }[] = []
  for (const [cx, cy, maxRx, maxRy, levels, wFreq, wAmp] of hills) {
    for (let lvl = 1; lvl <= levels; lvl++) {
      const t = lvl / levels
      const rx = maxRx * t, ry = maxRy * t
      const phase = lvl * 0.63
      const pts: string[] = []
      for (let s = 0; s <= STEPS; s++) {
        const θ = (s / STEPS) * Math.PI * 2
        const wobble = 1 + wAmp * Math.sin(wFreq * θ + phase) + wAmp * 0.4 * Math.cos((wFreq + 2) * θ + phase * 0.7)
        const x = cx + rx * wobble * Math.cos(θ)
        const y = cy + ry * wobble * Math.sin(θ)
        pts.push(`${s === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`)
      }
      pts.push('Z')
      out.push({ d: pts.join(' '), index: (levels - lvl) % 3 === 0 })
    }
  }
  return out
})()

function Marker() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden>
      <circle cx="8" cy="8" r="2.6" />
      <path d="M8 0.5V3.6M8 12.4V15.5M0.5 8H3.6M12.4 8H15.5" strokeLinecap="round" />
    </svg>
  )
}

type Size = 'hero' | 'wide' | 'std'

interface Mode {
  key:   GameMode
  label: string
  desc:  string
  img:   string
  size:  Size
  badge?: { text: string; cls: string }
}

// Tile size tracks popularity: Urban biggest → Terra/USA wide → rest square.
const MODES: Mode[] = [
  { key: 'urban',     label: 'Urban',     desc: 'Cities & towns worldwide', img: '/images/urban.jpg',     size: 'hero', badge: { text: 'Most popular', cls: 'sx-badge-top' } },
  { key: 'terra',     label: 'Terra',     desc: 'Anywhere on Earth',        img: '/images/terra.jpg',     size: 'wide', badge: { text: 'Featured',     cls: 'sx-badge-feat' } },
  { key: 'usa',       label: 'USA',       desc: 'Coast to coast',           img: '/images/usa.jpg',       size: 'wide', badge: { text: 'Popular',      cls: 'sx-badge-pop' } },
  { key: 'mountains', label: 'Mountains', desc: 'High peaks & glaciers',    img: '/images/mountains.jpg', size: 'wide' },
  { key: 'europe',    label: 'Europe',    desc: 'Towns & cities of Europe', img: '/images/europe.jpg',    size: 'std' },
  { key: 'islands',   label: 'Islands',   desc: 'Reefs & remote shores',    img: '/images/islands.jpg',   size: 'std' },
  { key: 'volcanoes', label: 'Volcanoes', desc: 'Active & dormant cones',   img: '/images/volcanoes.jpg', size: 'std' },
  { key: 'uncharted', label: 'Uncharted', desc: 'Jungle, desert & wild',    img: '/images/uncharted.jpg', size: 'std' },
  { key: 'airports',  label: 'Airports',  desc: 'Major hubs worldwide',     img: '/images/airports.jpg',  size: 'std' },
  { key: 'landmarks', label: 'Landmarks', desc: 'Iconic sites & wonders',   img: '/images/landmarks.jpg', size: 'std' },
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

  return (
    <div
      className="sx-root absolute inset-0 z-50 overflow-y-auto"
      style={{
        WebkitOverflowScrolling: 'touch' as never,
        overscrollBehavior:      'contain',
        animation:               'fadeIn 0.4s ease both',
      }}
    >
      <div
        className="relative"
        style={{
          minHeight:     '100%',
          maxWidth:      1100,
          margin:        '0 auto',
          paddingTop:    'calc(env(safe-area-inset-top, 0px) + 3rem)',
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 3rem)',
          paddingLeft:   'calc(env(safe-area-inset-left, 0px) + 1.4rem)',
          paddingRight:  'calc(env(safe-area-inset-right, 0px) + 1.4rem)',
        }}
      >
        {/* Contour brand texture */}
        <svg
          aria-hidden
          viewBox="0 0 1440 2000"
          preserveAspectRatio="xMidYMin slice"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
        >
          {TOPO_PATHS.map(({ d, index }, i) => (
            <path key={i} d={d} fill="none" stroke="#8fb4dc"
              strokeWidth={index ? 1.2 : 0.7} opacity={index ? 0.08 : 0.045} />
          ))}
        </svg>

        <div className="relative" style={{ zIndex: 10 }}>
          {/* ── Header ── */}
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 28 }}>
            <div>
              <p style={{
                fontFamily: 'var(--font-display), system-ui, sans-serif', fontSize: 11, fontWeight: 500,
                letterSpacing: '0.34em', color: 'rgba(233,238,247,0.42)', textTransform: 'uppercase', margin: '0 0 9px',
              }}>
                Geography · Satellite
              </p>
              <h1 style={{
                fontFamily: 'var(--font-display), system-ui, sans-serif', fontWeight: 700,
                fontSize: 'clamp(44px, 8vw, 78px)', lineHeight: 0.9, letterSpacing: '-0.02em', color: '#f5f2ec', margin: '0 0 12px',
              }}>
                Strata
              </h1>
              <p style={{ fontSize: 14.5, color: 'rgba(225,232,244,0.5)', margin: 0 }}>
                Five satellite snapshots. Guess where on Earth you are.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10 }}>
              <div style={{ display: 'inline-flex', gap: 3, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 11, padding: 4 }}>
                <button type="button" className="sx-tab sx-tab-active">Single Player</button>
                <button type="button" className="sx-tab" disabled style={{ cursor: 'default' }}>
                  Multiplayer
                  <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', background: 'rgba(255,255,255,0.08)', color: 'rgba(233,238,247,0.4)', padding: '2px 6px', borderRadius: 4 }}>Soon</span>
                </button>
              </div>
              {bestScore !== null && (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 7, fontFamily: 'var(--font-display), system-ui, sans-serif',
                  fontSize: 11.5, fontWeight: 500, letterSpacing: '0.03em', color: 'var(--accent)',
                  background: 'var(--accent-soft)', border: '1px solid var(--accent-line)', padding: '5px 12px', borderRadius: 999,
                }}>
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden>
                    <path d="M4 2h8v3a4 4 0 0 1-8 0V2Z" /><path d="M4 4H2v1a2 2 0 0 0 2 2M12 4h2v1a2 2 0 0 1-2 2M6 11h4M5.5 14h5M8 11v3" strokeLinecap="round" />
                  </svg>
                  Best {bestScore.toLocaleString()}
                </span>
              )}
            </div>
          </div>

          {/* ── Bento grid ── */}
          <div className="sx-grid">
            {MODES.map((m, i) => (
              <button
                key={m.key}
                type="button"
                className={`sx-tile ${m.size === 'hero' ? 'sx-hero' : m.size === 'wide' ? 'sx-wide' : ''}`}
                style={{ animationDelay: `${0.05 + i * 0.04}s` }}
                aria-label={`Play ${m.label} — ${m.desc}`}
                onClick={() => onPlay(m.key)}
              >
                <span className="sx-img" style={{ backgroundImage: `url(${m.img})` }} />
                <span className="sx-grad" />
                <span className="sx-mark"><Marker /></span>
                {m.badge && <span className={`sx-badge ${m.badge.cls}`}>{m.badge.text}</span>}
                <span className="sx-meta">
                  <span className="sx-name">{m.label}</span>
                  {m.size !== 'std' && <span className="sx-desc">{m.desc}</span>}
                </span>
              </button>
            ))}
          </div>

          <p style={{ marginTop: 24, fontSize: 10.5, letterSpacing: '0.05em', color: 'rgba(225,232,244,0.28)' }}>
            Imagery © Mapbox · Maxar · NASA
          </p>
        </div>
      </div>
    </div>
  )
}
