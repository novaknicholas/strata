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
    <div className="absolute top-4 left-1/2 -translate-x-1/2 pointer-events-none select-none z-30">
      <div
        className={`
          flex flex-col items-center gap-2 px-5 pt-2.5 pb-3 rounded-xl shadow-lg border
          bg-white/90 backdrop-blur-sm transition-colors duration-500
          ${urgent ? 'border-red-300' : 'border-stone-200'}
        `}
      >
        {/* Timer */}
        <span
          className={`font-mono text-2xl font-bold tabular-nums tracking-tight
            ${urgent ? 'text-red-500' : 'text-stone-800'}
          `}
        >
          {String(timeLeft).padStart(2, '0')}s
        </span>

        {/* Round dots */}
        <div className="flex items-center gap-1.5">
          {Array.from({ length: totalRounds }, (_, i) => (
            <div
              key={i}
              style={{
                width:        6,
                height:       6,
                borderRadius: '50%',
                background:   i < round
                  ? (urgent ? 'rgba(239,68,68,0.7)' : 'rgba(28,25,23,0.55)')
                  : 'rgba(28,25,23,0.12)',
                transition:   'background 0.3s',
              }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
