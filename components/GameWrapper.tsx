'use client'

import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import dynamic from 'next/dynamic'
import type mapboxgl from 'mapbox-gl'
import { haversineKm, calcScore } from '@/lib/haversine'
import { getGameLocation }                  from '@/lib/getGameLocation'
import { countryName }                       from '@/lib/countryName'
import type { RoundResult, GameMode, GameLocation } from '@/lib/types'

const GameMap       = dynamic(() => import('./GameMap'),       { ssr: false })
const MiniMap       = dynamic(() => import('./MiniMap'),       { ssr: false })
const HUD           = dynamic(() => import('./HUD'),           { ssr: false })
const ScaleBar      = dynamic(() => import('./ScaleBar'),      { ssr: false })
const ResultOverlay = dynamic(() => import('./ResultOverlay'), { ssr: false })

interface GameWrapperProps {
  /** Increments on each round transition — triggers in-place reset (NOT a React key). */
  roundKey:     number
  round:        number
  totalRounds:  number
  gameDuration: number
  gameMode:     GameMode
  /** Sum of scores from rounds already completed — does NOT include this round */
  runningTotal: number
  isLastRound:  boolean
  /** Called when the player advances; receives this round's result */
  onNext?:      (result: RoundResult) => void
}

export default function GameWrapper({
  roundKey,
  round,
  totalRounds,
  gameDuration: GAME_DURATION,
  gameMode,
  runningTotal,
  isLastRound,
  onNext,
}: GameWrapperProps) {
  const [target,       setTarget]       = useState<GameLocation>(() => getGameLocation(gameMode))
  const [guess,        setGuess]        = useState<[number, number] | null>(null)
  const [timeLeft,     setTimeLeft]     = useState(GAME_DURATION)
  const [phase,        setPhase]        = useState<'loading' | 'playing' | 'result'>('loading')
  const [mapInstance,  setMapInstance]  = useState<mapboxgl.Map | null>(null)
  const [timeTakenSec, setTimeTakenSec] = useState(0)
  const [locationName, setLocationName] = useState<string | null>(null)

  const intervalRef      = useRef<ReturnType<typeof setInterval> | null>(null)
  const gameStartTimeRef = useRef<number>(0)
  const pausedAtRef      = useRef<number | null>(null)   // set while tab is hidden during 'playing'
  const guessRef         = useRef<[number, number] | null>(null)
  const phaseRef         = useRef<'loading' | 'playing' | 'result'>('loading')
  const onNextRef        = useRef(onNext)
  const handleNextRef    = useRef<() => void>(() => {})
  useEffect(() => { onNextRef.current = onNext }, [onNext])

  useEffect(() => { guessRef.current = guess }, [guess])
  useEffect(() => { phaseRef.current = phase }, [phase])

  // ── Per-round reset (triggered by roundKey incrementing) ────────────────
  // Skip the initial mount — useState initializer already handles round 1.
  const isFirstRound = useRef(true)
  useEffect(() => {
    if (isFirstRound.current) { isFirstRound.current = false; return }

    // Stop any running timer and clear any paused-tab state
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    pausedAtRef.current = null

    // Pick new location and reset all round state in one batch
    setTarget(getGameLocation(gameMode))
    setGuess(null)
    setTimeLeft(GAME_DURATION)
    setPhase('loading')
    setTimeTakenSec(0)
    setLocationName(null)
  }, [roundKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derived result values ────────────────────────────────────────────────
  const distanceKm = guess ? haversineKm(guess, [target.lng, target.lat]) : null
  const score      = distanceKm !== null
    ? calcScore(distanceKm, timeTakenSec, GAME_DURATION)
    : 0

  const replayInfo = useMemo(() => {
    if (phase !== 'result' || !guess || distanceKm === null) return undefined
    return { guessLng: guess[0], guessLat: guess[1], distanceKm }
  }, [phase, guess, distanceKm])

  const miniMapShowResult = useMemo(
    () => phase === 'result' ? { targetLng: target.lng, targetLat: target.lat } : undefined,
    [phase, target],
  )

  // ── Location name: use built-in name or reverse-geocode ─────────────────
  useEffect(() => {
    if (phase !== 'result') return

    // Most modes carry a name in the data — skip the Mapbox API call.
    // Only Terra and Uncharted fall through to reverse-geocoding.
    if (target.name) {
      const country = countryName(target.country)
      setLocationName(country ? `${target.name}, ${country}` : target.name)
      return
    }

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
    pausedAtRef.current = null
    setTimeTakenSec(elapsed)
    setPhase('result')
  }, [])

  // ── Shared ticker — extracted so the visibility handler can restart it ───
  const startTicking = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current)
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
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Map ready: start clock ───────────────────────────────────────────────
  const handleMapReady = useCallback(() => {
    gameStartTimeRef.current = Date.now()
    setPhase('playing')
    startTicking()
  }, [startTicking])

  // ── Pause/resume timer when tab is hidden/shown ──────────────────────────
  // Without this, Date.now()-based elapsed time accumulates while the tab is
  // hidden, causing the round to auto-expire the moment the user returns.
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        // Tab hidden: freeze the timer if a round is in progress
        if (phaseRef.current !== 'playing') return
        if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }
        pausedAtRef.current = Date.now()
      } else {
        // Tab visible: shift gameStartTime forward by the hidden duration so
        // the remaining time is exactly what it was when the tab was hidden.
        if (pausedAtRef.current !== null && phaseRef.current === 'playing') {
          gameStartTimeRef.current += Date.now() - pausedAtRef.current
          startTicking()
        }
        pausedAtRef.current = null
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [startTicking])

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
  useEffect(() => { handleNextRef.current = handleNext }, [handleNext])

  const handleMapCreated = useCallback((map: mapboxgl.Map) => setMapInstance(map), [])
  const handleGuess      = useCallback((coords: [number, number]) => setGuess(coords), [])

  return (
    <div className="absolute inset-0">
      <GameMap
        roundKey={roundKey}
        target={target}
        onReady={handleMapReady}
        onMapCreated={handleMapCreated}
        frozen={phase === 'result'}
        replayInfo={replayInfo}
      />

      {mapInstance && <ScaleBar map={mapInstance} />}

      <MiniMap
        roundKey={roundKey}
        onGuess={handleGuess}
        onSubmit={handleSubmit}
        disabled={phase === 'result'}
        showResult={miniMapShowResult}
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
