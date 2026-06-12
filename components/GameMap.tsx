'use client'

import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { zoomForDistance } from '@/lib/haversine'

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!

// ─── Zoom waypoints — evenly spaced over TOTAL_MS ──────────────────────────
const ZOOMS    = [16, 14, 11, 6, 3.5] as const
const TOTAL_MS = 20_000

// ─── Catmull-Rom spline through ZOOMS ──────────────────────────────────────
function catmullRomZoom(t: number): number {
  const n   = ZOOMS.length - 1
  const raw = Math.min(t * n, n - 1e-9)
  const i   = Math.floor(raw)
  const u   = raw - i
  // Reflect boundary: p(-1)=p(1), p(n+1)=p(n-1).
  // This makes the tangent at each endpoint exactly zero, so the animation
  // starts and ends with zero zoom velocity — no abrupt jerk.
  const p   = (j: number) => j < 0 ? ZOOMS[Math.min(n, -j)]
                            : j > n ? ZOOMS[Math.max(0, 2 * n - j)]
                            : ZOOMS[j]
  const u2  = u * u
  const u3  = u2 * u
  return 0.5 * (
       2 * p(i) +
    (    -p(i - 1) +              p(i + 1)) * u +
    ( 2 * p(i - 1) - 5 * p(i) + 4 * p(i + 1) - p(i + 2)) * u2 +
    (    -p(i - 1) + 3 * p(i) - 3 * p(i + 1) + p(i + 2)) * u3
  )
}

const START_ZOOM = ZOOMS[0]
const END_ZOOM   = ZOOMS[ZOOMS.length - 1]
const ZOOM_RANGE = START_ZOOM - END_ZOOM

function zoomEasing(t: number): number {
  const z = catmullRomZoom(t)
  return Math.max(0, Math.min(1, (START_ZOOM - z) / ZOOM_RANGE))
}

interface ReplayInfo {
  guessLng:   number
  guessLat:   number
  distanceKm: number
}

interface GameMapProps {
  /** Increments each round — triggers in-place reset without remounting. */
  roundKey:      number
  target:        { lng: number; lat: number }
  onReady?:      () => void
  onMapCreated?: (map: mapboxgl.Map) => void
  frozen?:       boolean
  replayInfo?:   ReplayInfo
}

export default function GameMap({
  roundKey,
  target,
  onReady,
  onMapCreated,
  frozen,
  replayInfo,
}: GameMapProps) {
  const containerRef    = useRef<HTMLDivElement>(null)
  const mapRef          = useRef<mapboxgl.Map | null>(null)
  const onReadyRef      = useRef(onReady)
  const onCreatedRef    = useRef(onMapCreated)
  const targetRef       = useRef(target)          // stable ref for the [] creation effect
  const resultMarkerRef  = useRef<mapboxgl.Marker | null>(null)  // answer pin (round-end)
  const fallbackRef      = useRef<ReturnType<typeof setTimeout> | null>(null)
  const activeVisitorRef = useRef<(() => void) | null>(null)     // current waterfall step fn

  useEffect(() => { onReadyRef.current   = onReady      }, [onReady])
  useEffect(() => { onCreatedRef.current = onMapCreated }, [onMapCreated])
  useEffect(() => { targetRef.current    = target       }, [target])

  // ── Shared animation starter ──────────────────────────────────────────────
  // Pre-loads tiles at each animation waypoint zoom level while the loading
  // screen is still up, then starts the zoom-out easeTo. Because Mapbox only
  // fetches tiles for the current viewport, the only way to guarantee tiles at
  // zoom 11 are cached is to briefly visit zoom 11 — the loading screen covers
  // all these invisible jumps. Each lower zoom level loads in <500 ms (CDN-warm,
  // large-area tiles), so the loading screen extends by only ~1-2 s total.
  //
  // Uses a named-function sequential waterfall (not nested once() callbacks) so
  // any in-flight preload can be cleanly cancelled when Effect B resets the map.
  const triggerAnimation = (map: mapboxgl.Map) => {
    if (fallbackRef.current) clearTimeout(fallbackRef.current)

    // Cancel any waterfall still running from a previous triggerAnimation call
    if (activeVisitorRef.current) {
      map.off('idle', activeVisitorRef.current)
      activeVisitorRef.current = null
    }

    let fired = false

    function startAnim() {
      if (fired) return; fired = true
      activeVisitorRef.current = null
      if (fallbackRef.current) { clearTimeout(fallbackRef.current); fallbackRef.current = null }
      onReadyRef.current?.()
      map.easeTo({ zoom: END_ZOOM, duration: TOTAL_MS, easing: zoomEasing })
    }

    // Waypoints that mirror the animation's own zoom knots — every tile the
    // camera will pass through is guaranteed to be in cache before play starts.
    const PRELOAD = [14, 11, 6, END_ZOOM]
    let step = 0

    function visitNext() {
      if (fired) return
      if (step >= PRELOAD.length) {
        // All waypoints visited — snap back to start zoom and begin
        activeVisitorRef.current = null
        map.jumpTo({ zoom: START_ZOOM })
        startAnim()
        return
      }
      map.jumpTo({ zoom: PRELOAD[step++] })
      activeVisitorRef.current = visitNext   // keep ref current for cancellation
      map.once('idle', visitNext)
    }

    // Phase 1: wait for z16 tiles, then walk the waterfall
    activeVisitorRef.current = visitNext
    map.once('idle', visitNext)

    // Safety: if any step stalls beyond 10 s, skip preload and start anyway
    const t = setTimeout(() => {
      if (activeVisitorRef.current) {
        map.off('idle', activeVisitorRef.current)
        activeVisitorRef.current = null
      }
      map.jumpTo({ zoom: START_ZOOM })
      startAnim()
    }, 10_000)
    fallbackRef.current = t
  }

  // ── Effect A: create map once, destroy on session end ────────────────────
  // Deps: [] — runs exactly once on mount, cleanup on unmount.
  // Uses targetRef so the closure always reads the current target coords.
  useEffect(() => {
    if (!containerRef.current) return

    const map = new mapboxgl.Map({
      container:          containerRef.current,
      style:              'mapbox://styles/mapbox/satellite-v9',
      center:             [targetRef.current.lng, targetRef.current.lat],
      zoom:               START_ZOOM,
      interactive:        false,
      attributionControl: false,
      fadeDuration:       300,  // smooth tile cross-fade during zoom-out (0 caused tile pops)
      logoPosition:       'bottom-right',
      // Larger tile cache keeps more zoom levels resident during the animation,
      // reducing re-fetches as the camera sweeps from z16 → z3.5.
      maxTileCacheSize:   300,
    })

    map.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-left')
    onCreatedRef.current?.(map)
    mapRef.current = map
    triggerAnimation(map)

    return () => {
      if (fallbackRef.current)     clearTimeout(fallbackRef.current)
      if (activeVisitorRef.current) map.off('idle', activeVisitorRef.current)
      map.remove()
      mapRef.current = null
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Effect B: reset map in-place on round change ─────────────────────────
  // Deps: [target] — fires after GameWrapper's [roundKey] effect has called
  // setTarget(newLoc) and that state update has committed (render #2).
  // This guarantees target.lng/lat are the NEW round's coordinates, not the
  // previous round's stale values that were in scope during render #1.
  const isFirstRound = useRef(true)
  useEffect(() => {
    if (isFirstRound.current) { isFirstRound.current = false; return }
    const map = mapRef.current
    if (!map) return

    // Cancel zoom-out / result flyTo from the previous round
    map.stop()

    // Remove the answer marker placed at round end
    resultMarkerRef.current?.remove()
    resultMarkerRef.current = null

    // Snap to new location at full zoom — no animation so there's no visual transition
    map.jumpTo({ center: [target.lng, target.lat], zoom: START_ZOOM })

    // Re-arm the idle listener and start the new round's zoom-out
    triggerAnimation(map)
  }, [target]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Freeze: zoom out to show globe when result is shown ──────────────────
  useEffect(() => {
    if (!frozen || !mapRef.current) return
    mapRef.current.easeTo({
      zoom:     1.8,
      duration: 1_400,
      easing:   t => 1 - Math.pow(1 - t, 3),
    })
  }, [frozen])

  // ── Replay: fly to midpoint + drop answer marker ─────────────────────────
  useEffect(() => {
    if (!replayInfo || !mapRef.current) return
    const { guessLng, guessLat, distanceKm } = replayInfo

    const midLng = (guessLng + target.lng) / 2
    const midLat = (guessLat + target.lat) / 2

    const flyTimer = setTimeout(() => {
      if (!mapRef.current) return
      mapRef.current.flyTo({
        center:    [midLng, midLat],
        zoom:      zoomForDistance(distanceKm),
        duration:  2_500,
        curve:     1.4,
        essential: true,
      })
    }, 2_200)

    const markerTimer = setTimeout(() => {
      if (!mapRef.current) return
      resultMarkerRef.current = new mapboxgl.Marker({ color: '#f5f0e8' })
        .setLngLat([target.lng, target.lat])
        .addTo(mapRef.current)
    }, 5_100)

    return () => {
      clearTimeout(flyTimer)
      clearTimeout(markerTimer)
    }
  }, [replayInfo, target])

  return (
    <div
      ref={containerRef}
      className="game-map"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
    />
  )
}
