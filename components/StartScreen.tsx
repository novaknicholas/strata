'use client'

import { useEffect, useState } from 'react'

export type Difficulty = 'explorer' | 'navigator' | 'expert'

const DIFFICULTIES: { key: Difficulty; label: string; seconds: number; hint: string }[] = [
  { key: 'explorer',  label: 'Explorer',  seconds: 30, hint: '30 s per round'  },
  { key: 'navigator', label: 'Navigator', seconds: 20, hint: '20 s per round'  },
  { key: 'expert',    label: 'Expert',    seconds: 10, hint: '10 s per round'  },
]

const BEST_KEY = 'strata_best_score'

interface StartScreenProps {
  onStart: (difficulty: Difficulty) => void
}

export default function StartScreen({ onStart }: StartScreenProps) {
  const [selected, setSelected] = useState<Difficulty>('navigator')
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
      {/* Subtle world-grid texture */}
      <svg
        aria-hidden
        style={{
          position: 'absolute', inset: 0, width: '100%', height: '100%',
          opacity: 0.025, pointerEvents: 'none',
        }}
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="0.5"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>

      <div
        style={{
          display:       'flex',
          flexDirection: 'column',
          alignItems:    'center',
          gap:           0,
          animation:     'slideUp 0.5s cubic-bezier(0.16,1,0.3,1) both',
          animationDelay: '0.05s',
        }}
      >
        {/* Logo / title */}
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
          marginBottom:  52,
          textAlign:     'center',
        }}>
          5 satellite snapshots. Guess the location.
        </p>

        {/* Difficulty selector */}
        <div style={{
          display:      'flex',
          gap:          8,
          marginBottom: 40,
        }}>
          {DIFFICULTIES.map(d => {
            const active = selected === d.key
            return (
              <button
                key={d.key}
                onClick={() => setSelected(d.key)}
                style={{
                  padding:       '9px 18px',
                  background:    active ? 'rgba(255,255,255,0.10)' : 'transparent',
                  border:        `1px solid ${active ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.07)'}`,
                  borderRadius:  8,
                  cursor:        'pointer',
                  transition:    'all 0.15s',
                  display:       'flex',
                  flexDirection: 'column',
                  alignItems:    'center',
                  gap:           3,
                }}
              >
                <span style={{
                  color:         active ? '#fff' : 'rgba(255,255,255,0.32)',
                  fontSize:      12,
                  fontWeight:    active ? 700 : 500,
                  letterSpacing: '0.04em',
                  transition:    'color 0.15s',
                }}>
                  {d.label}
                </span>
                <span style={{
                  color:         active ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.15)',
                  fontSize:      10,
                  letterSpacing: '0.06em',
                  transition:    'color 0.15s',
                }}>
                  {d.hint}
                </span>
              </button>
            )
          })}
        </div>

        {/* Start button */}
        <button
          onClick={() => onStart(selected)}
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
          Start
        </button>

        {/* Personal best */}
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
