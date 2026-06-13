'use client'

import { useState }         from 'react'
import dynamic              from 'next/dynamic'
import MainMenu             from '@/components/MainMenu'
import GameWrapper          from '@/components/GameWrapper'
import type { GameMode, RoundResult } from '@/lib/types'

const SummaryOverlay = dynamic(() => import('@/components/SummaryOverlay'), { ssr: false })
const MapPrewarm     = dynamic(() => import('@/components/MapPrewarm'),     { ssr: false })

const TOTAL_ROUNDS   = 5
const GAME_DURATION  = 30

type GamePhase = 'menu' | 'playing' | 'summary'

export default function Home() {
  const [gamePhase,    setGamePhase]    = useState<GamePhase>('menu')
  const [gameMode,     setGameMode]     = useState<GameMode>('urban')
  const [results,      setResults]      = useState<RoundResult[]>([])
  const [currentRound, setCurrentRound] = useState(1)
  const [roundKey,     setRoundKey]     = useState(0)

  const runningTotal = results.reduce((s, r) => s + r.score, 0)

  const handlePlay = (mode: GameMode) => {
    setGameMode(mode)
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
    setGamePhase('menu')
  }

  return (
    <main className="fixed inset-0 overflow-hidden bg-stone-100">
      {gamePhase !== 'menu' && (
        <GameWrapper
          roundKey={roundKey}
          round={currentRound}
          totalRounds={TOTAL_ROUNDS}
          gameDuration={GAME_DURATION}
          gameMode={gameMode}
          runningTotal={runningTotal}
          isLastRound={currentRound === TOTAL_ROUNDS}
          onNext={handleNext}
        />
      )}

      {gamePhase === 'menu' && (
        <>
          <MapPrewarm />
          <MainMenu onPlay={handlePlay} />
        </>
      )}

      {gamePhase === 'summary' && (
        <SummaryOverlay
          results={results}
          totalRounds={TOTAL_ROUNDS}
          gameMode={gameMode}
          onPlayAgain={handlePlayAgain}
        />
      )}
    </main>
  )
}
