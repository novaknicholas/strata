'use client'

import { useEffect, useState } from 'react'
import type { GameMode } from '@/lib/types'

// ── Rolling-hill topographic contour paths ────────────────────────────────
// Each "hill" is a cluster of concentric closed ellipses (like a real topo map).
// Slight organic wobble on each ring keeps them from looking like perfect circles.
// viewBox is 1440 × 2000 so contours cover even tall mobile scroll pages.
const TOPO_PATHS: { d: string; index: boolean }[] = (() => {
  // [cx, cy, rx, ry, levels, wobbleFreq, wobbleAmp]
  type Hill = [number, number, number, number, number, number, number]
  const hills: Hill[] = [
    [  280,  320, 420, 230, 8, 4, 0.07],
    [ 1150,  230, 380, 210, 7, 3, 0.06],
    [  730,  700, 460, 260, 9, 5, 0.08],
    [  130, 1050, 320, 190, 6, 4, 0.06],
    [ 1240, 1080, 410, 235, 7, 3, 0.07],
    [  560, 1500, 390, 220, 7, 4, 0.07],
    [ 1060, 1780, 340, 195, 6, 5, 0.06],
    [   -60,  700, 270, 160, 5, 3, 0.05],   // partially off left edge
    [ 1510,  940, 300, 170, 5, 4, 0.05],   // partially off right edge
    [  880, 2020, 350, 200, 5, 4, 0.06],   // partially off bottom
  ]

  const STEPS = 120  // points per ring — more = smoother curves
  const results: { d: string; index: boolean }[] = []

  for (const [cx, cy, maxRx, maxRy, levels, wFreq, wAmp] of hills) {
    for (let lvl = 1; lvl <= levels; lvl++) {
      const t    = lvl / levels           // 1 = outermost ring, 1/levels = innermost
      const rx   = maxRx * t
      const ry   = maxRy * t
      const phaseOffset = lvl * 0.63      // each ring wobbles slightly differently

      const pts: string[] = []
      for (let s = 0; s <= STEPS; s++) {
        const θ      = (s / STEPS) * Math.PI * 2
        // Organic wobble: two harmonic terms
        const wobble = 1
          + wAmp       * Math.sin(wFreq * θ + phaseOffset)
          + wAmp * 0.4 * Math.cos((wFreq + 2) * θ + phaseOffset * 0.7)
        const x = cx + rx * wobble * Math.cos(θ)
        const y = cy + ry * wobble * Math.sin(θ)
        pts.push(`${s === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`)
      }
      pts.push('Z')

      // Every 3rd ring from the outside is an "index contour" (slightly heavier)
      const fromOuter = levels - lvl
      results.push({ d: pts.join(' '), index: fromOuter % 3 === 0 })
    }
  }
  return results
})()

// ── Mode definitions ──────────────────────────────────────────────────────
const MODES: {
  key:      GameMode
  label:    string
  desc:     string
  img:      string
  fallback: string
}[] = [
  { key: 'urban',     label: 'Urban',     desc: 'Cities & towns worldwide',       img: '/images/urban.jpg',     fallback: '#2C4A6E' },
  { key: 'uncharted', label: 'Uncharted', desc: 'Forests, deserts & wilderness',  img: '/images/uncharted.jpg', fallback: '#2D5A27' },
  { key: 'terra',     label: 'Terra',     desc: 'Anywhere on Earth',              img: '/images/terra.jpg',     fallback: '#1A2F4A' },
  { key: 'islands',   label: 'Islands',   desc: 'Tropical & remote islands',      img: '/images/islands.jpg',   fallback: '#1A4A4A' },
  { key: 'mountains', label: 'Mountains', desc: 'High peaks above 2,000 m',       img: '/images/mountains.jpg', fallback: '#3A3A4A' },
  { key: 'volcanoes', label: 'Volcanoes', desc: 'Active & dormant volcanoes',      img: '/images/volcanoes.jpg', fallback: '#4A1A0A' },
  { key: 'usa',       label: 'USA',       desc: 'Cities across the contiguous US', img: '/images/usa.jpg',       fallback: '#1A2A4A' },
  { key: 'europe',    label: 'Europe',    desc: 'Towns & cities across Europe',   img: '/images/europe.jpg',    fallback: '#2A2A3A' },
  { key: 'airports',  label: 'Airports',  desc: 'Major airports worldwide',        img: '/images/airports.jpg',  fallback: '#1A1A2A' },
  { key: 'landmarks', label: 'Landmarks', desc: 'Iconic sites & wonders',          img: '/images/landmarks.jpg', fallback: '#2A1A0A' },
]

const BEST_KEY = 'strata_best_score'

interface MainMenuProps {
  onPlay: (mode: GameMode) => void
}

export default function MainMenu({ onPlay }: MainMenuProps) {
  const [bestScore, setBestScore] = useState<number | null>(null)
  const [hovered,   setHovered]   = useState<GameMode | null>(null)
  const [visible,   setVisible]   = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 60)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    try {
      const stored = parseInt(localStorage.getItem(BEST_KEY) ?? '', 10)
      if (!isNaN(stored) && stored > 0) setBestScore(stored)
    } catch { /* storage blocked */ }
  }, [])

  if (!visible) return null

  return (
    /*
     * Root: absolute inset-0 so it sits over the game canvas layer.
     * overflow-y: auto makes it independently scrollable inside the fixed viewport —
     * body/html stays overflow:hidden (required for the game), but users can scroll
     * the menu freely on mobile.
     */
    <div
      className="absolute inset-0 z-50 overflow-y-auto"
      style={{
        background:               '#F3F1EC',
        WebkitOverflowScrolling:  'touch' as never,
        overscrollBehavior:       'contain',
        animation:                'fadeIn 0.3s ease both',
      }}
    >
      {/* ── Inner wrapper — sets the scrollable content area ─────────────── */}
      <div className="relative min-h-full">

        {/* ── Topo contour-line background (decorative) ─────────────────── */}
        <svg
          aria-hidden
          viewBox="0 0 1440 2000"
          preserveAspectRatio="xMidYMin slice"
          style={{
            position:      'absolute',
            inset:          0,
            width:         '100%',
            height:        '100%',
            pointerEvents: 'none',
          }}
        >
          {TOPO_PATHS.map(({ d, index }, i) => (
            <path
              key={i}
              d={d}
              fill="none"
              stroke="#5A7050"
              strokeWidth={index ? 1.3 : 0.75}
              opacity={index ? 0.12 : 0.07}
            />
          ))}
        </svg>

        {/* ── Main content ──────────────────────────────────────────────── */}
        <div
          className="relative z-10 flex flex-col items-center"
          style={{
            paddingTop:    'calc(env(safe-area-inset-top, 0px) + 3rem)',
            paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 3rem)',
            paddingLeft:   '1.25rem',
            paddingRight:  '1.25rem',
            maxWidth:      1100,
            margin:        '0 auto',
            animation:     'slideUp 0.5s cubic-bezier(0.16,1,0.3,1) both',
            animationDelay: '0.04s',
          }}
        >

          {/* ── Title ─────────────────────────────────────────────────── */}
          <p style={{
            fontSize:      11,
            fontWeight:    600,
            letterSpacing: '0.25em',
            color:         'rgba(0,0,0,0.25)',
            textTransform: 'uppercase',
            marginBottom:  16,
          }}>
            Geography
          </p>

          <h1
            className="text-6xl sm:text-8xl"
            style={{
              fontWeight:    900,
              letterSpacing: '0.22em',
              color:         '#141414',
              textTransform: 'uppercase',
              lineHeight:    1,
              textAlign:     'center',
              marginBottom:  14,
            }}
          >
            Strata
          </h1>

          <p style={{
            fontSize:      14,
            color:         'rgba(0,0,0,0.36)',
            letterSpacing: '0.01em',
            marginBottom:  40,
            textAlign:     'center',
          }}>
            5 satellite snapshots. Guess the location.
          </p>

          {/* ── Tab bar ───────────────────────────────────────────────── */}
          <div
            style={{
              display:      'flex',
              gap:          3,
              background:   'rgba(0,0,0,0.07)',
              borderRadius: 12,
              padding:      4,
              marginBottom: 40,
            }}
          >
            {/* Single Player — active */}
            <div style={{
              padding:      '9px 22px',
              background:   '#fff',
              borderRadius: 9,
              fontSize:     13,
              fontWeight:   600,
              color:        '#141414',
              boxShadow:    '0 1px 5px rgba(0,0,0,0.10)',
              letterSpacing:'0.01em',
              userSelect:   'none',
            }}>
              Single Player
            </div>

            {/* Multiplayer — coming soon */}
            <div style={{
              padding:     '9px 22px',
              borderRadius: 9,
              fontSize:     13,
              fontWeight:   500,
              color:        'rgba(0,0,0,0.26)',
              display:      'flex',
              alignItems:   'center',
              gap:          7,
              userSelect:   'none',
              cursor:       'default',
            }}>
              Multiplayer
              <span style={{
                fontSize:      8,
                fontWeight:    700,
                letterSpacing: '0.10em',
                textTransform: 'uppercase',
                background:    'rgba(0,0,0,0.08)',
                color:         'rgba(0,0,0,0.28)',
                padding:       '2px 6px',
                borderRadius:   4,
              }}>
                Soon
              </span>
            </div>
          </div>

          {/* ── Mode tiles ────────────────────────────────────────────── */}
          {/*
           * grid-cols-2 on mobile (2 per row, scrollable)
           * sm:grid-cols-4 on desktop (4 per row, 3 rows for 10 modes)
           */}
          <div
            className="grid grid-cols-2 sm:grid-cols-4 w-full"
            style={{ gap: 14, marginBottom: 44 }}
          >
            {MODES.map(mode => {
              const active = hovered === mode.key
              return (
                <div
                  key={mode.key}
                  role="button"
                  tabIndex={0}
                  aria-label={`Play ${mode.label} mode — ${mode.desc}`}
                  onClick={() => onPlay(mode.key)}
                  onKeyDown={e => e.key === 'Enter' && onPlay(mode.key)}
                  onMouseEnter={() => setHovered(mode.key)}
                  onMouseLeave={() => setHovered(null)}
                  className="h-[200px] sm:h-[280px]"
                  style={{
                    position:   'relative',
                    borderRadius: 18,
                    overflow:   'hidden',
                    cursor:     'pointer',
                    background: mode.fallback,
                    boxShadow:  active
                      ? '0 10px 40px rgba(0,0,0,0.28), 0 2px 8px rgba(0,0,0,0.14)'
                      : '0 3px 16px rgba(0,0,0,0.14)',
                    transform:  active ? 'translateY(-3px) scale(1.007)' : 'none',
                    transition: 'box-shadow 0.22s, transform 0.22s',
                    outline:    'none',
                    // Active ring on keyboard focus
                    WebkitTapHighlightColor: 'transparent',
                  }}
                >
                  {/* Background satellite image — zooms in on hover */}
                  <div style={{
                    position:           'absolute',
                    inset:               0,
                    backgroundImage:    `url(${mode.img})`,
                    backgroundSize:     'cover',
                    backgroundPosition: 'center',
                    transform:          active ? 'scale(1.06)' : 'scale(1)',
                    transition:         'transform 0.38s cubic-bezier(0.16,1,0.3,1)',
                  }} />

                  {/* Gradient overlay — stronger at bottom for text contrast */}
                  <div style={{
                    position:   'absolute',
                    inset:       0,
                    background: 'linear-gradient(to bottom, rgba(0,0,0,0.03) 0%, rgba(0,0,0,0.48) 58%, rgba(0,0,0,0.74) 100%)',
                  }} />

                  {/* Mode text */}
                  <div style={{
                    position: 'absolute',
                    bottom:   0,
                    left:     0,
                    right:    0,
                    padding: '18px 22px',
                  }}>
                    <div style={{
                      color:       '#fff',
                      fontSize:    20,
                      fontWeight:  700,
                      letterSpacing: '0.02em',
                      marginBottom: 4,
                      textShadow: '0 1px 6px rgba(0,0,0,0.35)',
                    }}>
                      {mode.label}
                    </div>
                    <div style={{
                      color:       'rgba(255,255,255,0.72)',
                      fontSize:    12.5,
                      letterSpacing: '0.01em',
                      textShadow: '0 1px 4px rgba(0,0,0,0.4)',
                    }}>
                      {mode.desc}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* ── Personal best ─────────────────────────────────────────── */}
          {bestScore !== null && (
            <p style={{
              color:         'rgba(0,0,0,0.22)',
              fontSize:      11,
              letterSpacing: '0.08em',
              textAlign:     'center',
            }}>
              Best: {bestScore.toLocaleString()} / 30,000
            </p>
          )}

        </div>
      </div>
    </div>
  )
}
