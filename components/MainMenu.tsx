'use client'

import { useEffect, useState } from 'react'
import type { GameMode } from '@/lib/types'

// ── Topographic contour paths — computed once at module level ─────────────
// 26 organic wavy lines spanning the full viewBox height (covers tall mobile pages)
const TOPO_PATHS: string[] = (() => {
  const paths: string[] = []
  for (let i = 0; i < 26; i++) {
    const baseY = i * 58
    const amp   = 7  + (i % 5) * 4.5
    const f1    = 0.0020 + (i % 4) * 0.0006
    const f2    = f1 * 2.7
    const phase = i * 1.52
    const pts: string[] = []
    for (let x = -100; x <= 1540; x += 11) {
      const y = baseY
        + amp * Math.sin(x * f1 + phase)
        + amp * 0.38 * Math.cos(x * f2 + phase * 0.58)
      pts.push(`${x === -100 ? 'M' : 'L'}${x.toFixed(0)},${y.toFixed(1)}`)
    }
    paths.push(pts.join(' '))
  }
  return paths
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
          viewBox="0 0 1440 1500"
          preserveAspectRatio="none"
          style={{
            position:      'absolute',
            inset:          0,
            width:         '100%',
            height:        '100%',
            pointerEvents: 'none',
          }}
        >
          {TOPO_PATHS.map((d, i) => (
            <path
              key={i}
              d={d}
              fill="none"
              stroke="#5A7050"
              strokeWidth={i % 5 === 0 ? 1.4 : 0.8}
              opacity={i % 5 === 0 ? 0.11 : 0.065}
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
           * grid-cols-1 on mobile (full-width tiles, stacked, scroll to see all)
           * sm:grid-cols-3 on desktop (side by side)
           */}
          <div
            className="grid grid-cols-1 sm:grid-cols-3 w-full"
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
                  style={{
                    position:   'relative',
                    borderRadius: 18,
                    overflow:   'hidden',
                    cursor:     'pointer',
                    aspectRatio: '16 / 9',
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
