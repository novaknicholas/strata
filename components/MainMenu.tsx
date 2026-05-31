'use client'

import { useEffect, useState } from 'react'
import type { GameMode }       from '@/lib/types'

const MODES: {
  key:   GameMode
  label: string
  sub:   string
}[] = [
  { key: 'urban',     label: 'Urban',     sub: 'Cities & settlements' },
  { key: 'uncharted', label: 'Uncharted', sub: 'Wilderness only'       },
  { key: 'terra',     label: 'Terra',     sub: 'Anywhere on Earth'     },
]

const BEST_KEY = 'strata_best_score'

interface MainMenuProps {
  onPlay: (mode: GameMode) => void
}

export default function MainMenu({ onPlay }: MainMenuProps) {
  const [selected,  setSelected]  = useState<GameMode>('urban')
  const [bestScore, setBestScore] = useState<number | null>(null)
  const [btnHover,  setBtnHover]  = useState(false)
  const [visible,   setVisible]   = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 80)
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
    <div
      className="absolute inset-0 z-50 flex items-center justify-center"
      style={{
        background: 'rgba(6,6,8,1)',
        animation:  'fadeIn 0.4s ease both',
      }}
    >
      {/* Subtle grid texture */}
      <svg
        aria-hidden
        style={{
          position: 'absolute', inset: 0, width: '100%', height: '100%',
          opacity: 0.025, pointerEvents: 'none',
        }}
      >
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="0.5"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>

      <div style={{
        display:        'flex',
        flexDirection:  'column',
        alignItems:     'center',
        gap:            0,
        animation:      'slideUp 0.5s cubic-bezier(0.16,1,0.3,1) both',
        animationDelay: '0.05s',
        padding:        '0 24px',
        width:          '100%',
        maxWidth:       520,
      }}>
        {/* Wordmark */}
        <p style={{
          color:         'rgba(255,255,255,0.12)',
          fontSize:      11,
          fontWeight:    600,
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          marginBottom:  14,
        }}>
          Strata
        </p>

        <h1 style={{
          color:         '#fff',
          fontSize:      72,
          fontWeight:    700,
          letterSpacing: '-0.04em',
          lineHeight:    1,
          marginBottom:  10,
          textAlign:     'center',
        }}>
          Where<br />in the world?
        </h1>

        <p style={{
          color:         'rgba(255,255,255,0.28)',
          fontSize:      14,
          fontWeight:    400,
          letterSpacing: '-0.01em',
          marginBottom:  48,
          textAlign:     'center',
        }}>
          5 satellite snapshots. Guess the location.
        </p>

        {/* Mode cards */}
        <div style={{
          display:      'flex',
          gap:          8,
          marginBottom: 32,
          width:        '100%',
          justifyContent: 'center',
        }}>
          {MODES.map(m => {
            const active = selected === m.key
            return (
              <button
                key={m.key}
                onClick={() => setSelected(m.key)}
                style={{
                  flex:          1,
                  maxWidth:      148,
                  padding:       '14px 12px',
                  background:    active ? 'rgba(255,255,255,0.10)' : 'transparent',
                  border:        `1px solid ${active ? 'rgba(255,255,255,0.20)' : 'rgba(255,255,255,0.07)'}`,
                  borderRadius:  10,
                  cursor:        'pointer',
                  transition:    'all 0.15s',
                  display:       'flex',
                  flexDirection: 'column',
                  alignItems:    'center',
                  gap:           4,
                  textAlign:     'center' as const,
                }}
              >
                <span style={{
                  color:         active ? '#fff' : 'rgba(255,255,255,0.36)',
                  fontSize:      13,
                  fontWeight:    active ? 700 : 500,
                  letterSpacing: '0.03em',
                  transition:    'color 0.15s',
                }}>
                  {m.label}
                </span>
                <span style={{
                  color:         active ? 'rgba(255,255,255,0.38)' : 'rgba(255,255,255,0.14)',
                  fontSize:      10,
                  letterSpacing: '0.04em',
                  lineHeight:    1.3,
                  transition:    'color 0.15s',
                }}>
                  {m.sub}
                </span>
              </button>
            )
          })}
        </div>

        {/* Play button */}
        <button
          onClick={() => onPlay(selected)}
          onMouseEnter={() => setBtnHover(true)}
          onMouseLeave={() => setBtnHover(false)}
          style={{
            width:         220,
            padding:       '14px 0',
            background:    btnHover ? '#fff' : 'rgba(255,255,255,0.92)',
            border:        'none',
            borderRadius:  10,
            color:         'rgba(0,0,0,0.85)',
            fontSize:      13,
            fontWeight:    700,
            letterSpacing: '0.10em',
            textTransform: 'uppercase' as const,
            cursor:        'pointer',
            transition:    'background 0.12s, transform 0.12s',
            transform:     btnHover ? 'scale(1.03)' : 'scale(1)',
            marginBottom:  24,
          }}
        >
          Play
        </button>

        {bestScore !== null && (
          <p style={{
            color:         'rgba(255,255,255,0.18)',
            fontSize:      11,
            letterSpacing: '0.08em',
          }}>
            Best: {bestScore.toLocaleString()} / 30,000
          </p>
        )}
      </div>
    </div>
  )
}
