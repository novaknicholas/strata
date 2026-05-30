'use client'

import { useEffect, useState, useRef } from 'react'
import type { RoundResult }            from '@/lib/types'

interface SummaryOverlayProps {
  results:      RoundResult[]
  totalRounds:  number
  gameDuration: number
  onPlayAgain:  () => void
}

function formatDist(km: number | null): string {
  if (km === null) return '—'
  if (km < 1)      return `${Math.round(km * 1_000)} m`
  if (km < 100)    return `${km.toFixed(1)} km`
  return `${Math.round(km).toLocaleString()} km`
}

const MAX_PER_ROUND  = 6_000
const BEST_KEY       = 'strata_best_score'

function grade(pct: number): string {
  if (pct >= 90) return 'Flawless'
  if (pct >= 75) return 'Excellent'
  if (pct >= 55) return 'Strong'
  if (pct >= 35) return 'Decent'
  if (pct >= 15) return 'Rough'
  return 'Keep exploring'
}

export default function SummaryOverlay({ results, totalRounds, gameDuration, onPlayAgain }: SummaryOverlayProps) {
  const total     = results.reduce((s, r) => s + r.score, 0)
  const maxTotal  = MAX_PER_ROUND * totalRounds
  const bestScore = Math.max(...results.map(r => r.score), 0)
  const totalPct  = Math.round((total / maxTotal) * 100)

  const [displayTotal,  setDisplayTotal]  = useState(0)
  const [visible,       setVisible]       = useState(false)
  const [barsAnimated,  setBarsAnimated]  = useState(false)
  const [isNewBest,     setIsNewBest]     = useState(false)
  const [prevBest,      setPrevBest]      = useState(0)
  const [copyLabel,     setCopyLabel]     = useState('Share')
  const [btnHover,      setBtnHover]      = useState(false)
  const [shareHover,    setShareHover]    = useState(false)
  const copyTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Cleanup on unmount (e.g. Play Again clicked right after Share)
  useEffect(() => () => { if (copyTimeout.current) clearTimeout(copyTimeout.current) }, [])

  // ── Personal best (localStorage) ────────────────────────────────────────
  useEffect(() => {
    try {
      const stored = parseInt(localStorage.getItem(BEST_KEY) ?? '0', 10)
      setPrevBest(stored)
      if (total > stored) {
        localStorage.setItem(BEST_KEY, String(total))
        setIsNewBest(true)
      }
    } catch { /* storage blocked */ }
  }, [total])

  // ── Entrance delay ───────────────────────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 200)
    return () => clearTimeout(t)
  }, [])

  // ── Bars animate in one frame after card appears ─────────────────────────
  useEffect(() => {
    if (!visible) return
    const t = setTimeout(() => setBarsAnimated(true), 60)
    return () => clearTimeout(t)
  }, [visible])

  // ── Total score count-up ─────────────────────────────────────────────────
  useEffect(() => {
    if (!visible) return
    const start    = performance.now()
    const duration = 1_600
    function step(now: number) {
      const p     = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - p, 3)
      setDisplayTotal(Math.round(total * eased))
      if (p < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [visible, total])

  // ── Share / copy ─────────────────────────────────────────────────────────
  const diffLabel = gameDuration >= 30 ? 'Explorer' : gameDuration >= 20 ? 'Navigator' : 'Expert'

  const handleShare = () => {
    const lines = [
      `Strata [${diffLabel}] — ${grade(totalPct)} · ${total.toLocaleString()} / ${maxTotal.toLocaleString()}`,
      '',
      results.map((r, i) =>
        `${i + 1}. ${r.didGuess ? `${formatDist(r.distanceKm)} · ${r.score.toLocaleString()} pts` : 'no guess'}`
      ).join('\n'),
      '',
      'play at strata.game',
    ].join('\n')

    navigator.clipboard.writeText(lines).then(() => {
      setCopyLabel('Copied!')
      if (copyTimeout.current) clearTimeout(copyTimeout.current)
      copyTimeout.current = setTimeout(() => setCopyLabel('Share'), 2_000)
    }).catch(() => setCopyLabel('Share'))
  }

  if (!visible) return null

  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center"
      style={{
        background:           'rgba(4,4,6,0.82)',
        backdropFilter:       'blur(18px)',
        WebkitBackdropFilter: 'blur(18px)',
        animation:            'fadeIn 0.35s ease both',
      }}
    >
      <div style={{ animation: 'slideUp 0.45s cubic-bezier(0.16,1,0.3,1) both' }}>
        <div style={{
          width:                340,
          background:           'rgba(10,10,13,0.97)',
          backdropFilter:       'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border:               '1px solid rgba(255,255,255,0.07)',
          borderRadius:         20,
          padding:              '28px 26px 24px',
          boxShadow:            '0 40px 100px rgba(0,0,0,0.9)',
        }}>

          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <p style={{
              color:         'rgba(255,255,255,0.22)',
              fontSize:      10,
              fontWeight:    600,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              marginBottom:  5,
            }}>
              Game complete
            </p>
            <p style={{
              color:      'rgba(255,255,255,0.6)',
              fontSize:   16,
              fontWeight: 600,
            }}>
              {grade(totalPct)}
            </p>
          </div>

          {/* Per-round breakdown */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginBottom: 22 }}>
            {results.map((r, i) => {
              const pct    = Math.round((r.score / MAX_PER_ROUND) * 100)
              const isBest = r.score === bestScore && bestScore > 0
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{
                    color:         isBest ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.18)',
                    fontSize:      10,
                    fontWeight:    700,
                    width:         12,
                    textAlign:     'right',
                    flexShrink:    0,
                  }}>
                    {i + 1}
                  </span>

                  {/* Animated bar */}
                  <div style={{
                    flex:         1,
                    height:       3,
                    background:   'rgba(255,255,255,0.06)',
                    borderRadius: 2,
                    overflow:     'hidden',
                  }}>
                    <div style={{
                      height:       '100%',
                      width:        barsAnimated ? `${pct}%` : '0%',
                      background:   isBest
                        ? 'rgba(255,255,255,0.75)'
                        : 'rgba(255,255,255,0.28)',
                      borderRadius: 2,
                      transition:   `width ${0.55 + i * 0.07}s cubic-bezier(0.16,1,0.3,1)`,
                    }} />
                  </div>

                  <span style={{
                    color:              'rgba(255,255,255,0.18)',
                    fontSize:           9,
                    width:              36,
                    textAlign:          'right',
                    flexShrink:         0,
                    fontVariantNumeric: 'tabular-nums',
                  }}>
                    {formatDist(r.distanceKm)}
                  </span>

                  <span style={{
                    color:              isBest ? '#fff' : 'rgba(255,255,255,0.4)',
                    fontSize:           12,
                    fontWeight:         isBest ? 700 : 500,
                    fontVariantNumeric: 'tabular-nums',
                    width:              42,
                    textAlign:          'right',
                    flexShrink:         0,
                  }}>
                    {r.score.toLocaleString()}
                  </span>
                </div>
              )
            })}
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', marginBottom: 18 }} />

          {/* Total score */}
          <p style={{
            color:              '#fff',
            fontSize:           54,
            fontWeight:         700,
            letterSpacing:      '-0.03em',
            lineHeight:         1,
            textAlign:          'center',
            fontVariantNumeric: 'tabular-nums',
            marginBottom:       10,
          }}>
            {displayTotal.toLocaleString()}
          </p>

          {/* Total bar */}
          <div style={{
            height:       2,
            background:   'rgba(255,255,255,0.08)',
            borderRadius: 1,
            overflow:     'hidden',
            marginBottom: 6,
          }}>
            <div style={{
              height:       '100%',
              width:        barsAnimated ? `${totalPct}%` : '0%',
              background:   'rgba(255,255,255,0.5)',
              borderRadius: 1,
              transition:   'width 0.9s cubic-bezier(0.16,1,0.3,1)',
            }} />
          </div>

          <p style={{
            color:        'rgba(255,255,255,0.15)',
            fontSize:     10,
            textAlign:    'center',
            marginBottom: 16,
          }}>
            of {maxTotal.toLocaleString()}
          </p>

          {/* Personal best */}
          <div style={{
            display:        'flex',
            justifyContent: 'center',
            alignItems:     'center',
            gap:            6,
            marginBottom:   20,
            minHeight:      18,
          }}>
            {isNewBest ? (
              <span style={{
                color:         'rgba(255,255,255,0.55)',
                fontSize:      10,
                fontWeight:    700,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
              }}>
                ↑ New best{prevBest > 0 ? ` · was ${prevBest.toLocaleString()}` : ''}
              </span>
            ) : prevBest > 0 ? (
              <span style={{
                color:         'rgba(255,255,255,0.2)',
                fontSize:      10,
                letterSpacing: '0.08em',
              }}>
                Best: {prevBest.toLocaleString()}
              </span>
            ) : null}
          </div>

          {/* Buttons row */}
          <div style={{ display: 'flex', gap: 8 }}>
            {/* Share */}
            <button
              onClick={handleShare}
              onMouseEnter={() => setShareHover(true)}
              onMouseLeave={() => setShareHover(false)}
              style={{
                flex:          '0 0 auto',
                padding:       '11px 14px',
                background:    shareHover ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.06)',
                border:        '1px solid rgba(255,255,255,0.10)',
                borderRadius:  9,
                color:         shareHover ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.4)',
                fontSize:      11,
                fontWeight:    600,
                letterSpacing: '0.10em',
                textTransform: 'uppercase' as const,
                cursor:        'pointer',
                transition:    'all 0.12s',
                whiteSpace:    'nowrap' as const,
              }}
            >
              {copyLabel}
            </button>

            {/* Play Again */}
            <button
              onClick={onPlayAgain}
              onMouseEnter={() => setBtnHover(true)}
              onMouseLeave={() => setBtnHover(false)}
              style={{
                flex:          1,
                padding:       '11px 0',
                background:    btnHover ? '#fff' : 'rgba(255,255,255,0.92)',
                border:        'none',
                borderRadius:  9,
                color:         'rgba(0,0,0,0.85)',
                fontSize:      12,
                fontWeight:    700,
                letterSpacing: '0.10em',
                textTransform: 'uppercase' as const,
                cursor:        'pointer',
                transition:    'background 0.12s, transform 0.12s',
                transform:     btnHover ? 'scale(1.02)' : 'scale(1)',
              }}
            >
              Play again
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
