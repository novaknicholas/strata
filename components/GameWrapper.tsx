'use client'

import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import dynamic from 'next/dynamic'
import type mapboxgl from 'mapbox-gl'
import { randomLandPoint }        from '@/lib/randomLandPoint'
import { haversineKm, calcScore } from '@/lib/haversine'
import type { RoundResult }       from '@/lib/types'

const GameMap       = dynamic(() => import('./GameMap'),       { ssr: false })
const MiniMap       = dynamic(() => import('./MiniMap'),       { ssr: false })
const HUD           = dynamic(() => import('./HUD'),           { ssr: false })
const ScaleBar      = dynamic(() => import('./ScaleBar'),      { ssr: false })
const ResultOverlay = dynamic(() => import('./ResultOverlay'), { ssr: false })

interface GameWrapperProps {
  round:        number
  totalRounds:  number
  gameDuration: number          // seconds per round, set by difficulty
  /** Sum of scores from rounds already completed — does NOT include this round */
  runningTotal: number
  isLastRound:  boolean
  /** Called when the player advances; receives this round's result */
  onNext?:      (result: RoundResult) => void
}

export default function GameWrapper({
  round,
  totalRounds,
  gameDuration: GAME_DURATION,
  runningTotal,
  isLastRound,
  onNext,
}: GameWrapperProps) {
  const [target]      = useState(() => randomLandPoint())
  const [guess,  setGuess]         = useState<[number, number] | null>(null)
  const [timeLeft,    setTimeLeft]  = useState(GAME_DURATION)
  const [phase,       setPhase]     = useState<'loading' | 'playing' | 'result'>('loading')
  const [mapInstance, setMapInstance] = useState<mapboxgl.Map | null>(null)
  const [timeTakenSec,  setTimeTakenSec]  = useState(0)
  const [locationName,  setLocationName]  = useState<string | null>(null)

  const intervalRef      = useRef<ReturnType<typeof setInterval> | null>(null)
  const gameStartTimeRef = useRef<number>(0)
  const guessRef = useRef<[number, number] | null>(null)
  const phaseRef = useRef<'loading' | 'playing' | 'result'>('loading')
  const onNextRef    = useRef(onNext)
  const handleNextRef = useRef<() => void>(() => {})
  useEffect(() => { onNextRef.current = onNext }, [onNext])

  useEffect(() => { guessRef.current = guess }, [guess])
  useEffect(() => { phaseRef.current = phase }, [phase])

  // ── Derived result values ────────────────────────────────────────────────
  const distanceKm = guess ? haversineKm(guess, [target.lng, target.lat]) : null
  const score      = distanceKm !== null
    ? calcScore(distanceKm, timeTakenSec, GAME_DURATION)
    : 0

  const replayInfo = useMemo(() => {
    if (phase !== 'result' || !guess || distanceKm === null) return undefined
    return { guessLng: guess[0], guessLat: guess[1], distanceKm }
  }, [phase, guess, distanceKm])

  // ── Reverse-geocode target once results appear ───────────────────────────
  useEffect(() => {
    if (phase !== 'result') return
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
    if (!token) return
    fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/` +
      `${target.lng},${target.lat}.json` +
      `?access_token=${token}&types=place,region,country&limit=1`,
    )
      .then(r => r.json())
      .then(data => {
        const feat    = data.features?.[0]
        if (!feat) { setLocationName('Unknown location'); return }
        const primary = (feat.text as string) || ''
        const country = ((feat.context ?? []) as { id: string; text: string }[])
          .find(c => c.id.startsWith('country'))?.text ?? ''
        setLocationName(
          primary && country && primary !== country
            ? `${primary}, ${country}`
            : primary || country || 'Unknown location',
        )
      })
      .catch(() => setLocationName('Unknown location'))
  }, [phase, target])

  // ── Stop timer, capture elapsed, transition to result ───────────────────
  const endRound = useCallback((elapsed: number) => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    setTimeTakenSec(elapsed)
    setPhase('result')
  }, [])

  // ── Map ready: start clock ───────────────────────────────────────────────
  const handleMapReady = useCallback(() => {
    gameStartTimeRef.current = Date.now()
    setPhase('playing')
    intervalRef.current = setInterval(() => {
      const elapsed   = (Date.now() - gameStartTimeRef.current) / 1_000
      const remaining = Math.max(0, GAME_DURATION - elapsed)
      setTimeLeft(Math.ceil(remaining))
      if (remaining <= 0) {
        clearInterval(intervalRef.current!)
        intervalRef.current = null
        setTimeTakenSec(GAME_DURATION)
        setPhase('result')
      }
    }, 100)
  }, [])

  // ── Guess submission ─────────────────────────────────────────────────────
  const handleSubmit = useCallback(() => {
    if (phaseRef.current !== 'playing' || !guessRef.current) return
    const elapsed = parseFloat(
      Math.min((Date.now() - gameStartTimeRef.current) / 1_000, GAME_DURATION).toFixed(2)
    )
    endRound(elapsed)
  }, [endRound])

  // Enter key: submit guess while playing, advance to next round while in result
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter') return
      if (phaseRef.current === 'playing') handleSubmit()
      else if (phaseRef.current === 'result') handleNextRef.current()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handleSubmit])

  // ── Next button: bank result + advance ──────────────────────────────────
  const handleNext = useCallback(() => {
    const dist = guessRef.current
      ? haversineKm(guessRef.current, [target.lng, target.lat])
      : null
    const sc   = dist !== null ? calcScore(dist, timeTakenSec, GAME_DURATION) : 0
    onNextRef.current?.({
      score:        sc,
      distanceKm:   dist,
      timeTakenSec,
      didGuess:     guessRef.current !== null,
    })
  }, [target, timeTakenSec])
  // Keep a stable ref so the keyboard handler can call handleNext without
  // being in its dependency array (handleNext recreates on timeTakenSec changes).
  useEffect(() => { handleNextRef.current = handleNext }, [handleNext])

  const handleMapCreated = useCallback((map: mapboxgl.Map) => setMapInstance(map), [])
  const handleGuess      = useCallback((coords: [number, number]) => setGuess(coords), [])

  return (
    <div className="absolute inset-0">
      <GameMap
        target={target}
        onReady={handleMapReady}
        onMapCreated={handleMapCreated}
        frozen={phase === 'result'}
        replayInfo={replayInfo}
      />

      {mapInstance && <ScaleBar map={mapInstance} />}

      <MiniMap
        onGuess={handleGuess}
        onSubmit={handleSubmit}
        disabled={phase === 'result'}
        showResult={
          phase === 'result'
            ? { targetLng: target.lng, targetLat: target.lat }
            : undefined
        }
      />

      <HUD
        timeLeft={timeLeft}
        phase={phase}
        hasGuess={guess !== null}
        round={round}
        totalRounds={totalRounds}
      />

      {phase === 'result' && (
        <ResultOverlay
          distanceKm={distanceKm}
          timeTakenSec={timeTakenSec}
          score={score}
          locationName={locationName}
          didGuess={guess !== null}
          round={round}
          totalRounds={totalRounds}
          runningTotal={runningTotal + score}
          isLastRound={isLastRound}
          onNext={handleNext}
        />
      )}

      {phase === 'loading' && (
        <div className="absolute inset-0 bg-stone-100 flex flex-col items-center justify-center gap-3 z-50">
          <div className="w-8 h-8 rounded-full border-2 border-stone-300 border-t-stone-700 animate-spin" />
          <div className="flex flex-col items-center gap-1.5">
            <p className="text-stone-500 text-sm font-medium tracking-widest uppercase">
              Loading location…
            </p>
            <p className="text-stone-400 text-[11px] tracking-widest uppercase">
              Round {round} of {totalRounds}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
