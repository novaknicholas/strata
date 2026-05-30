'use client'

import { useEffect, useState } from 'react'

interface ResultOverlayProps {
  distanceKm:   number | null
  timeTakenSec: number
  score:        number
  locationName: string | null
  didGuess:     boolean
  round:        number
  totalRounds:  number
  /** Previous rounds + this round — shown as running total */
  runningTotal: number
  isLastRound:  boolean
  onNext?:      () => void
}

function formatDist(km: number): string {
  if (km < 1)   return `${Math.round(km * 1_000)} m`
  if (km < 100) return `${km.toFixed(1)} km`
  return `${Math.round(km).toLocaleString()} km`
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <p style={{
        color:              '#fff',
        fontSize:           34,
        fontWeight:         700,
        letterSpacing:      '-0.02em',
        lineHeight:         1,
        fontVariantNumeric: 'tabular-nums',
      }}>
        {value}
      </p>
      <p style={{
        color:         'rgba(255,255,255,0.25)',
        fontSize:      10,
        fontWeight:    600,
        letterSpacing: '0.13em',
        textTransform: 'uppercase',
        marginTop:     5,
      }}>
        {label}
      </p>
    </div>
  )
}

export default function ResultOverlay({
  distanceKm,
  timeTakenSec,
  score,
  locationName,
  didGuess,
  round,
  totalRounds,
  runningTotal,
  isLastRound,
  onNext,
}: ResultOverlayProps) {
  const [displayScore, setDisplayScore] = useState(0)
  const [visible,      setVisible]      = useState(false)
  const [btnHover,     setBtnHover]     = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 900)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    if (!visible || !didGuess) return
    const start    = performance.now()
    const duration = 1_100
    function step(now: number) {
      const p     = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - p, 3)
      setDisplayScore(Math.round(score * eased))
      if (p < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [visible, score, didGuess])

  if (!visible) return null

  const pct         = Math.round((score / 6_000) * 100)
  const maxTotal    = totalRounds * 6_000
  const totalPct    = Math.round((runningTotal / maxTotal) * 100)
  const showRunning = round > 1 || isLastRound

  const nextLabel = isLastRound ? 'Final score →' : 'Next round →'

  return (
    <div
      className="absolute inset-0 pointer-events-none z-40 flex items-center justify-center"
      style={{ paddingBottom: 80 }}
    >
      <div
        className="pointer-events-auto"
        style={{ animation: 'slideUp 0.4s cubic-bezier(0.16,1,0.3,1) both' }}
      >
        <div style={{
          width:                296,
          background:           'rgba(8,8,10,0.92)',
          backdropFilter:       'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border:               '1px solid rgba(255,255,255,0.06)',
          borderRadius:         16,
          padding:              '24px 28px 20px',
          boxShadow:            '0 24px 60px rgba(0,0,0,0.7)',
        }}>

          {/* Round progress dots */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 18 }}>
            {Array.from({ length: totalRounds }, (_, i) => (
              <div
                key={i}
                style={{
                  width:        6,
                  height:       6,
                  borderRadius: '50%',
                  background:   i < round
                    ? 'rgba(255,255,255,0.65)'
                    : 'rgba(255,255,255,0.12)',
                  transition: 'background 0.3s',
                }}
              />
            ))}
          </div>

          {/* Location */}
          <p style={{
            color:         'rgba(255,255,255,0.3)',
            fontSize:      10,
            fontWeight:    600,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            marginBottom:  18,
            textAlign:     'center',
            minHeight:     12,
          }}>
            {locationName ?? '—'}
          </p>

          {didGuess ? (
            <>
              {/* Distance + Time */}
              <div style={{
                display:             'grid',
                gridTemplateColumns: '1fr 1px 1fr',
                alignItems:          'center',
                gap:                 '0 16px',
                marginBottom:        24,
              }}>
                <Stat value={formatDist(distanceKm!)} label="Distance" />
                <div style={{ height: 36, background: 'rgba(255,255,255,0.07)' }} />
                <Stat value={`${timeTakenSec.toFixed(2)}s`} label="Time" />
              </div>

              <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', marginBottom: 20 }} />

              {/* Score label */}
              <p style={{
                color:         'rgba(255,255,255,0.25)',
                fontSize:      10,
                fontWeight:    600,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                marginBottom:  8,
                textAlign:     'center',
              }}>
                Round score
              </p>

              {/* Animated score */}
              <p style={{
                color:              '#fff',
                fontSize:           46,
                fontWeight:         700,
                letterSpacing:      '-0.025em',
                lineHeight:         1,
                fontVariantNumeric: 'tabular-nums',
                marginBottom:       12,
                textAlign:          'center',
              }}>
                {displayScore.toLocaleString()}
              </p>

              {/* Per-round progress bar */}
              <div style={{
                height:       2,
                background:   'rgba(255,255,255,0.08)',
                borderRadius: 1,
                overflow:     'hidden',
                marginBottom: 6,
              }}>
                <div style={{
                  height:       '100%',
                  width:        `${pct}%`,
                  background:   'rgba(255,255,255,0.45)',
                  borderRadius: 1,
                  transition:   'width 0.05s linear',
                }} />
              </div>

              <p style={{
                color:        'rgba(255,255,255,0.15)',
                fontSize:     10,
                textAlign:    'center',
                marginBottom: showRunning ? 16 : 0,
              }}>
                of 6,000
              </p>

              {/* Running total — only from round 2 onwards */}
              {showRunning && (
                <div style={{
                  display:        'flex',
                  alignItems:     'center',
                  justifyContent: 'space-between',
                  padding:        '10px 12px',
                  background:     'rgba(255,255,255,0.04)',
                  borderRadius:   8,
                  border:         '1px solid rgba(255,255,255,0.06)',
                }}>
                  <span style={{
                    color:         'rgba(255,255,255,0.3)',
                    fontSize:      10,
                    fontWeight:    600,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                  }}>
                    Total
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {/* Mini total bar */}
                    <div style={{
                      width:        56,
                      height:       2,
                      background:   'rgba(255,255,255,0.08)',
                      borderRadius: 1,
                      overflow:     'hidden',
                    }}>
                      <div style={{
                        height:       '100%',
                        width:        `${totalPct}%`,
                        background:   'rgba(255,255,255,0.35)',
                        borderRadius: 1,
                      }} />
                    </div>
                    <span style={{
                      color:              'rgba(255,255,255,0.6)',
                      fontSize:           13,
                      fontWeight:         700,
                      fontVariantNumeric: 'tabular-nums',
                    }}>
                      {runningTotal.toLocaleString()}
                    </span>
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              <p style={{
                color:       '#fff',
                fontSize:    20,
                fontWeight:  600,
                textAlign:   'center',
                marginBottom: 6,
              }}>
                Time&apos;s up
              </p>
              <p style={{
                color:        'rgba(255,255,255,0.3)',
                fontSize:     12,
                textAlign:    'center',
                marginBottom: showRunning ? 16 : 0,
              }}>
                No guess was placed
              </p>

              {showRunning && (
                <div style={{
                  display:        'flex',
                  alignItems:     'center',
                  justifyContent: 'space-between',
                  padding:        '10px 12px',
                  background:     'rgba(255,255,255,0.04)',
                  borderRadius:   8,
                  border:         '1px solid rgba(255,255,255,0.06)',
                }}>
                  <span style={{
                    color: 'rgba(255,255,255,0.3)', fontSize: 10,
                    fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase',
                  }}>Total</span>
                  <span style={{
                    color: 'rgba(255,255,255,0.6)', fontSize: 13,
                    fontWeight: 700, fontVariantNumeric: 'tabular-nums',
                  }}>
                    {runningTotal.toLocaleString()}
                  </span>
                </div>
              )}
            </>
          )}

          {/* Next / Final score button */}
          {onNext && (
            <button
              onClick={onNext}
              onMouseEnter={() => setBtnHover(true)}
              onMouseLeave={() => setBtnHover(false)}
              style={{
                display:       'block',
                width:         '100%',
                marginTop:     16,
                padding:       '12px 0',
                background:    btnHover ? '#fff' : 'rgba(255,255,255,0.92)',
                border:        'none',
                borderRadius:  9,
                color:         btnHover ? '#000' : 'rgba(0,0,0,0.82)',
                fontSize:      12,
                fontWeight:    700,
                letterSpacing: '0.10em',
                textTransform: 'uppercase' as const,
                cursor:        'pointer',
                transition:    'background 0.12s, transform 0.12s',
                transform:     btnHover ? 'scale(1.02)' : 'scale(1)',
              }}
            >
              {nextLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
