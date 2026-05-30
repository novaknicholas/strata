'use client'

interface HUDProps {
  timeLeft:    number
  phase:       'loading' | 'playing' | 'result'
  hasGuess:    boolean
  round:       number
  totalRounds: number
}

export default function HUD({ timeLeft, phase, round, totalRounds }: HUDProps) {
  if (phase === 'loading' || phase === 'result') return null
  const urgent = timeLeft <= 10 && phase === 'playing'

  return (
    <div
      className="absolute left-1/2 -translate-x-1/2 pointer-events-none select-none z-30"
      style={{ top: 'calc(1rem + env(safe-area-inset-top, 0px))' }}
    >
      {/* Horizontal pill: [● ● ○ ○ ○] | [20s] */}
      <div
        className={`
          flex items-center gap-3 px-4 py-2 rounded-full shadow-md border
          bg-white/90 backdrop-blur-sm transition-colors duration-500
          ${urgent ? 'border-red-300' : 'border-stone-200'}
        `}
      >
        {/* Round progress dots */}
        <div className="flex items-center gap-[5px]">
          {Array.from({ length: totalRounds }, (_, i) => (
            <div
              key={i}
              style={{
                width:        5,
                height:       5,
                borderRadius: '50%',
                background:   i < round
                  ? (urgent ? 'rgba(239,68,68,0.75)' : 'rgba(28,25,23,0.6)')
                  : 'rgba(28,25,23,0.13)',
                transition:   'background 0.3s',
              }}
            />
          ))}
        </div>

        {/* Divider */}
        <div
          style={{
            width:      1,
            height:     14,
            background: urgent ? 'rgba(239,68,68,0.25)' : 'rgba(28,25,23,0.12)',
            flexShrink: 0,
            transition: 'background 0.5s',
          }}
        />

        {/* Timer */}
        <span
          style={{
            fontFamily:         'var(--font-geist-sans), ui-monospace, monospace',
            fontSize:            15,
            fontWeight:          700,
            letterSpacing:      '-0.01em',
            fontVariantNumeric: 'tabular-nums',
            color:               urgent ? '#ef4444' : '#1c1917',
            transition:          'color 0.5s',
          }}
        >
          {String(timeLeft).padStart(2, '0')}s
        </span>
      </div>
    </div>
  )
}
