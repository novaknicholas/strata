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
// Phantom endpoints clamp to ZOOMS[0] / ZOOMS[last] for natural slow-start
// and slow-end while keeping interior waypoints jerk-free (C¹ continuity).
function catmullRomZoom(t: number): number {
  const n   = ZOOMS.length - 1
  const raw = Math.min(t * n, n - 1e-9)
  const i   = Math.floor(raw)
  const u   = raw - i
  const p   = (j: number) => ZOOMS[Math.max(0, Math.min(n, j))]
  const u2  = u * u
  const u3  = u2 * u
  return 0.5 * (
       2 * p(i) +
    (    -p(i - 1) +              p(i + 1)) * u +
    ( 2 * p(i - 1) - 5 * p(i) + 4 * p(i + 1) - p(i + 2)) * u2 +
    (    -p(i - 1) + 3 * p(i) - 3 * p(i + 1) + p(i + 2)) * u3
  )
}

// Converts the Catmull-Rom zoom curve to a Mapbox easing function [0→1].
// Mapbox uses this to interpolate zoom from startZoom to endZoom, so we
// invert: progress = how far along the zoom range we are.
const START_ZOOM = ZOOMS[0]
const END_ZOOM   = ZOOMS[ZOOMS.length - 1]
const ZOOM_RANGE = START_ZOOM - END_ZOOM   // 12.5

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
  target:        { lng: number; lat: number }
  onReady?:      () => void
  onMapCreated?: (map: mapboxgl.Map) => void
  frozen?:       boolean
  replayInfo?:   ReplayInfo
}

export default function GameMap({
  target,
  onReady,
  onMapCreated,
  frozen,
  replayInfo,
}: GameMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef       = useRef<mapboxgl.Map | null>(null)
  const onReadyRef   = useRef(onReady)
  const onCreatedRef = useRef(onMapCreated)
  useEffect(() => { onReadyRef.current   = onReady      }, [onReady])
  useEffect(() => { onCreatedRef.current = onMapCreated }, [onMapCreated])

  // ── Map init ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (mapRef.current || !containerRef.current) return

    const map = new mapboxgl.Map({
      container:          containerRef.current,
      style:              'mapbox://styles/mapbox/satellite-v9',
      center:             [target.lng, target.lat],
      zoom:               START_ZOOM,
      interactive:        false,
      attributionControl: false,
      fadeDuration:       0,
      logoPosition:       'bottom-right',
    })

    map.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-left')
    onCreatedRef.current?.(map)
    mapRef.current = map

    // ── Seamless zoom-out via single easeTo + Catmull-Rom easing ─────────
    // Using Mapbox's own animation engine avoids the sub-pixel WebGL jitter
    // caused by calling jumpTo() from an external requestAnimationFrame loop.
    let started = false

    function startAnimation() {
      if (started) return
      started = true
      onReadyRef.current?.()

      map.easeTo({
        zoom:     END_ZOOM,
        duration: TOTAL_MS,
        easing:   zoomEasing,
      })
    }

    const fallback = setTimeout(startAnimation, 6_000)
    map.once('idle', () => { clearTimeout(fallback); startAnimation() })

    return () => {
      clearTimeout(fallback)
      map.remove()
      mapRef.current = null
    }
  }, [target])

  // ── Freeze: new easeTo naturally cancels the zoom animation ──────────
  useEffect(() => {
    if (!frozen || !mapRef.current) return
    mapRef.current.easeTo({
      zoom:     1.8,
      duration: 1_400,
      easing:   t => 1 - Math.pow(1 - t, 3),
    })
  }, [frozen])

  // ── Replay: zoom back to target area + drop a marker ─────────────────
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
      new mapboxgl.Marker({ color: '#f5f0e8' })
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
      style={{ position: 'absolute', inset: 0, width: '100vw', height: '100vh' }}
    />
  )
}
