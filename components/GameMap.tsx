'use client'

import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { zoomForDistance } from '@/lib/haversine'
import { mountPersistentMap, detachPersistentMap } from '@/lib/persistentMap'
import { createMainMap, MAIN_MAP_KEY } from '@/lib/createMaps'

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!

// ─── Zoom waypoints — evenly spaced over TOTAL_MS ──────────────────────────
const ZOOMS    = [16, 14, 11, 6, 3.5] as const
const TOTAL_MS = 30_000   // full round — slower zoom gives tiles more dwell time

// Hard cap on the pre-round tile warm. The no-black floor loads first and in
// well under a second; the rest of the budget fills the level pyramid in
// consumption order, so a truncation only ever costs the lowest-priority tail.
const LOAD_CAP_MS = 4_000

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

// Drift: final phase only — z6 → z3.5, the last quarter of the spline —
// pans by up to ±3° lng / ±2° lat from the target. Subtle (a few percent of
// the continental-scale viewport) but enough that the answer is never
// pinned to the exact centre of the screen.
const DRIFT_ZOOM     = ZOOMS[3]   // z6 — spline knot hit exactly at t = 0.75
const DRIFT_T        = 0.75
const MAX_DRIFT_LNG  = 3
const MAX_DRIFT_LAT  = 2

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v))
}

// The animation is two chained easeTo calls split at the z6 knot, so drift
// can ride only on the final phase. Each easing replays its part of the same
// Catmull-Rom spline — the combined zoom trajectory is identical to a
// single-easeTo version, including knot velocity at the seam.
function zoomEasingMain(s: number): number {
  return clamp01((START_ZOOM - catmullRomZoom(s * DRIFT_T)) / (START_ZOOM - DRIFT_ZOOM))
}
function zoomEasingDrift(s: number): number {
  return clamp01((DRIFT_ZOOM - catmullRomZoom(DRIFT_T + s * (1 - DRIFT_T))) / (DRIFT_ZOOM - END_ZOOM))
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
  const containerRef     = useRef<HTMLDivElement>(null)
  const mapRef           = useRef<mapboxgl.Map | null>(null)
  const onReadyRef       = useRef(onReady)
  const onCreatedRef     = useRef(onMapCreated)
  const targetRef        = useRef(target)          // stable ref for the [] mount effect
  const resultMarkerRef  = useRef<mapboxgl.Marker | null>(null)  // answer pin (round-end)
  const loadSeqRef       = useRef(0)               // invalidates in-flight load sequences
  const waiterCleanupRef = useRef<(() => void) | null>(null)
  const capTimerRef      = useRef<ReturnType<typeof setTimeout> | null>(null)
  const driftTimerRef    = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => { onReadyRef.current   = onReady      }, [onReady])
  useEffect(() => { onCreatedRef.current = onMapCreated }, [onMapCreated])
  useEffect(() => { targetRef.current    = target       }, [target])

  // ── Warm-then-animate loader ──────────────────────────────────────────────
  // Visits a priority-ordered list of camera states behind the loading screen
  // so every tile the round needs is cached before play begins:
  //
  //   1. END state (z3.5 @ drifted centre) — the NO-BLACK FLOOR. The end
  //      viewport geographically contains every frame of the flight, so once
  //      its tiles exist, every later frame has a loaded ancestor and black
  //      tiles are structurally impossible.
  //   2. START view (z16 @ target) — the opening frame, sharp.
  //   3. Half-zoom fill, 15.5 → 4.5, each centred on the camera's actual
  //      position when that level displays widest (raster sources round
  //      fractional zoom, so z = N−0.5 is level N+1's widest moment; during
  //      the drift phase the centre interpolates toward endCenter).
  //   4. Frozen-reveal floor (z2.5, z1.8) — levels shown by the result
  //      zoom-out to the globe.
  //
  // Steps advance on areTilesLoaded() (faster than 'idle' — no render
  // settling), under a LOAD_CAP_MS adaptive cap: normal connections finish
  // the whole list; slow ones start anyway with the floor guarantee intact.
  // The tab-lifetime tile cache makes rounds after the first mostly instant.
  const triggerAnimation = (map: mapboxgl.Map) => {
    const seq = ++loadSeqRef.current
    waiterCleanupRef.current?.()
    if (capTimerRef.current)   { clearTimeout(capTimerRef.current);   capTimerRef.current   = null }
    if (driftTimerRef.current) { clearTimeout(driftTimerRef.current); driftTimerRef.current = null }

    // Hide the canvas while the loader jumps around (loading overlay covers
    // it too — this guards against that ever becoming translucent).
    if (containerRef.current) containerRef.current.style.opacity = '0'

    const target: [number, number] = [targetRef.current.lng, targetRef.current.lat]
    const endCenter: [number, number] = [
      target[0] + (Math.random() * 2 - 1) * MAX_DRIFT_LNG,
      Math.max(-85, Math.min(85, target[1] + (Math.random() * 2 - 1) * MAX_DRIFT_LAT)),
    ]

    // Camera centre when the map zoom passes z (pan is linear in zoom
    // within the drift easeTo; zero pan before the drift phase).
    const centerAt = (z: number): [number, number] => {
      const p = z >= DRIFT_ZOOM ? 0 : (DRIFT_ZOOM - z) / (DRIFT_ZOOM - END_ZOOM)
      return [
        target[0] + (endCenter[0] - target[0]) * p,
        target[1] + (endCenter[1] - target[1]) * p,
      ]
    }

    // Ordered by how VISIBLE each stop's failure would be, so a cap
    // truncation always costs the least-noticeable tail:
    //   floors first (black / coarse-globe prevention), then the opening
    //   frame, then mid/low fills (failure = glaring coarse fallback at mid
    //   zoom), and the two highest fills last — their failure window is the
    //   animation's opening seconds where zoom velocity ≈ 0 and the edge
    //   reveal rate is sub-pixel, so live-loading there is nearly invisible.
    const stops: { zoom: number; center: [number, number] }[] = [
      { zoom: END_ZOOM,   center: endCenter },   // animation floor — black impossible after this
      { zoom: 2.5,        center: endCenter },   // result-globe floor
      { zoom: 1.8,        center: endCenter },   // result-globe floor (usually menu-warmed)
      { zoom: START_ZOOM, center: target },      // opening frame
    ]
    for (let z = START_ZOOM - 2.5; z > END_ZOOM; z -= 1) {
      stops.push({ zoom: z, center: centerAt(z) })          // mid/low pyramid fill
    }
    stops.push({ zoom: START_ZOOM - 0.5, center: centerAt(START_ZOOM - 0.5) })  // high fills last
    stops.push({ zoom: START_ZOOM - 1.5, center: centerAt(START_ZOOM - 1.5) })

    let done = false

    const finish = () => {
      if (done || loadSeqRef.current !== seq) return
      done = true
      waiterCleanupRef.current?.()
      if (capTimerRef.current) { clearTimeout(capTimerRef.current); capTimerRef.current = null }

      map.jumpTo({ center: target, zoom: START_ZOOM })
      if (containerRef.current) containerRef.current.style.opacity = '1'
      onReadyRef.current?.()

      // Main phase: pure centred zoom-out, z16 → z6
      map.easeTo({
        center:   target,
        zoom:     DRIFT_ZOOM,
        duration: TOTAL_MS * DRIFT_T,
        easing:   zoomEasingMain,
      })

      // Drift phase: z6 → z3.5 panning to the drifted centre. easeTo always
      // starts from the live camera state, so a few ms of timer slop cannot
      // cause a jump. Cleared if the round ends or resets first.
      driftTimerRef.current = setTimeout(() => {
        driftTimerRef.current = null
        map.easeTo({
          center:   endCenter,
          zoom:     END_ZOOM,
          duration: TOTAL_MS * (1 - DRIFT_T),
          easing:   zoomEasingDrift,
        })
      }, TOTAL_MS * DRIFT_T)
    }

    // Advance when the current viewport's tiles are loaded.
    //
    // CRITICAL ordering detail: Mapbox recomputes tile coverage during the
    // first render AFTER a camera change. Calling areTilesLoaded()
    // synchronously after jumpTo reads the PREVIOUS viewport's state (all
    // loaded) and advances instantly — collapsing the whole warm sequence
    // into a no-op. So the first check is gated behind one 'render' event.
    const waitTiles = (cb: () => void) => {
      let sawRender = false
      const check = () => {
        if (loadSeqRef.current !== seq) { cleanup(); return }
        if (!sawRender) return
        if (map.areTilesLoaded())       { cleanup(); cb() }
      }
      const onRender = () => { sawRender = true; check() }
      const cleanup = () => {
        map.off('sourcedata', check)
        map.off('render', onRender)
        waiterCleanupRef.current = null
      }
      waiterCleanupRef.current = cleanup
      map.on('sourcedata', check)
      map.on('render', onRender)
      map.triggerRepaint()   // guarantee a render even if the stop is fully cached
    }

    const t0 = performance.now()
    let i = 0
    const visitNext = () => {
      if (done || loadSeqRef.current !== seq) return
      if (i >= stops.length) {
        console.debug(`[strata] warm complete: ${stops.length} stops in ${Math.round(performance.now() - t0)} ms`)
        finish()
        return
      }
      const s = stops[i++]
      const tStop = performance.now()
      map.jumpTo({ zoom: s.zoom, center: s.center })
      waitTiles(() => {
        console.debug(`[strata] warm stop ${i}/${stops.length} z${s.zoom} in ${Math.round(performance.now() - tStop)} ms`)
        visitNext()
      })
    }

    const startCap = () => {
      capTimerRef.current = setTimeout(() => {
        if (loadSeqRef.current !== seq) return
        // Hidden tab: rAF is frozen, so the warm can't advance (it steps on
        // render events) — burning the cap now would start the round cold.
        // Re-arm and wait for the tab to come back.
        if (document.hidden) { startCap(); return }
        console.debug(`[strata] warm CAP hit at stop ${i}/${stops.length} — starting anyway`)
        finish()
      }, LOAD_CAP_MS)
    }

    const begin = () => {
      if (loadSeqRef.current !== seq) return
      startCap()
      visitNext()
    }
    if (map.isStyleLoaded()) begin()
    else map.once('style.load', begin)
  }

  // ── Effect A: mount the tab-lifetime map ─────────────────────────────────
  // The Map is constructed once per tab (one map-load credit, ever) and only
  // DETACHED on unmount — menu visits and new games reattach the same
  // instance with its tile cache intact.
  useEffect(() => {
    if (!containerRef.current) return

    // Normally created earlier by MapPrewarm (menu); direct creation here is
    // the fallback if a game starts without the menu having mounted.
    const { map, created } = mountPersistentMap(MAIN_MAP_KEY, containerRef.current, el =>
      createMainMap(el, [targetRef.current.lng, targetRef.current.lat], START_ZOOM)
    )
    if (!created) map.stop()   // reattached — cancel whatever it was doing

    onCreatedRef.current?.(map)
    mapRef.current = map
    triggerAnimation(map)

    return () => {
      loadSeqRef.current++             // invalidate any in-flight loader
      waiterCleanupRef.current?.()
      if (capTimerRef.current)   clearTimeout(capTimerRef.current)
      if (driftTimerRef.current) clearTimeout(driftTimerRef.current)
      resultMarkerRef.current?.remove()
      resultMarkerRef.current = null
      map.stop()
      detachPersistentMap(MAIN_MAP_KEY)   // detach, never remove() — tab-lifetime
      mapRef.current = null
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Effect B: reset in-place on round change ─────────────────────────────
  // Deps: [target] — fires after GameWrapper's [roundKey] effect has called
  // setTarget(newLoc) and that state update has committed (render #2), so
  // the coordinates here are always the NEW round's.
  const isFirstRound = useRef(true)
  useEffect(() => {
    if (isFirstRound.current) { isFirstRound.current = false; return }
    const map = mapRef.current
    if (!map) return

    map.stop()
    resultMarkerRef.current?.remove()
    resultMarkerRef.current = null
    triggerAnimation(map)
  }, [target]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Freeze: zoom out to show globe when result is shown ──────────────────
  useEffect(() => {
    if (!frozen || !mapRef.current) return
    // Round ended — kill a pending drift-phase easeTo so it can't yank the
    // camera after the result view takes over (guess made before 22.5 s).
    if (driftTimerRef.current) { clearTimeout(driftTimerRef.current); driftTimerRef.current = null }
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
