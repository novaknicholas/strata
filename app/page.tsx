'use client'

import { useState }               from 'react'
import dynamic                    from 'next/dynamic'
import GameWrapper                 from '@/components/GameWrapper'
import StartScreen, { type Difficulty } from '@/components/StartScreen'
import type { RoundResult }        from '@/lib/types'

const SummaryOverlay = dynamic(() => import('@/components/SummaryOverlay'), { ssr: false })

const TOTAL_ROUNDS = 5

const DURATION: Record<Difficulty, number> = {
  explorer:  30,
  navigator: 20,
  expert:    10,
}

type GamePhase = 'start' | 'playing' | 'summary'

export default function Home() {
  const [gamePhase,    setGamePhase]    = useState<GamePhase>('start')
  const [difficulty,   setDifficulty]   = useState<Difficulty>('navigator')
  const [results,      setResults]      = useState<RoundResult[]>([])
  const [currentRound, setCurrentRound] = useState(1)
  const [roundKey,     setRoundKey]     = useState(0)

  const gameDuration = DURATION[difficulty]
  const runningTotal = results.reduce((s, r) => s + r.score, 0)

  const handleStart = (chosen: Difficulty) => {
    setDifficulty(chosen)
    setGamePhase('playing')
  }

  const handleNext = (result: RoundResult) => {
    const newResults = [...results, result]
    setResults(newResults)
    if (currentRound >= TOTAL_ROUNDS) {
      setGamePhase('summary')
    } else {
      setCurrentRound(r => r + 1)
      setRoundKey(k => k + 1)
    }
  }

  const handlePlayAgain = () => {
    setResults([])
    setCurrentRound(1)
    setRoundKey(k => k + 1)
    setGamePhase('start')   // return to start screen so player can change difficulty
  }

  return (
    <main className="fixed inset-0 overflow-hidden bg-stone-100">
      {/* Game layer — always rendered so the map preloads on start screen */}
      {gamePhase !== 'start' && (
        <GameWrapper
          key={roundKey}
          round={currentRound}
          totalRounds={TOTAL_ROUNDS}
          gameDuration={gameDuration}
          runningTotal={runningTotal}
          isLastRound={currentRound === TOTAL_ROUNDS}
          onNext={handleNext}
        />
      )}

      {/* Overlays */}
      {gamePhase === 'start' && <StartScreen onStart={handleStart} />}

      {gamePhase === 'summary' && (
        <SummaryOverlay
          results={results}
          totalRounds={TOTAL_ROUNDS}
          gameDuration={gameDuration}
          onPlayAgain={handlePlayAgain}
        />
      )}
    </main>
  )
}
