'use client'

import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!

interface ResultData {
  targetLng: number
  targetLat: number
}

interface MiniMapProps {
  onGuess:     (coords: [number, number]) => void
  onSubmit?:   () => void
  disabled?:   boolean
  showResult?: ResultData   // draws line + target pin, fits bounds
}

const SIZES = {
  small:    { w: 300, h: 210 },
  expanded: { w: 540, h: 400 },
} as const

export default function MiniMap({ onGuess, onSubmit, disabled = false, showResult }: MiniMapProps) {
  const panelRef      = useRef<HTMLDivElement>(null)
  const containerRef  = useRef<HTMLDivElement>(null)
  const mapRef        = useRef<mapboxgl.Map | null>(null)
  const markerRef     = useRef<mapboxgl.Marker | null>(null)
  const onGuessRef    = useRef(onGuess)
  const disabledRef   = useRef(disabled)
  const onSubmitRef   = useRef(onSubmit)
  const [size, setSize]   = useState<'small' | 'expanded'>('small')
  const [hasPin, setHasPin] = useState(false)

  useEffect(() => { onGuessRef.current  = onGuess  }, [onGuess])
  useEffect(() => { disabledRef.current = disabled }, [disabled])
  useEffect(() => { onSubmitRef.current = onSubmit }, [onSubmit])

  // Initialise Mapbox once
  useEffect(() => {
    if (mapRef.current || !containerRef.current) return

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/outdoors-v12',
      center: [0, 20],
      zoom: 1.5,
      attributionControl: false,
    })

    map.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-left')

    // Crosshair cursor to signal clickability
    map.on('load', () => {
      map.getCanvas().style.cursor = 'crosshair'
    })
    // Restore crosshair after drag ends (Mapbox resets it to 'grab')
    map.on('dragend', () => {
      map.getCanvas().style.cursor = 'crosshair'
    })

    map.on('click', (e) => {
      if (disabledRef.current) return

      const { lng, lat } = e.lngLat

      if (markerRef.current) {
        markerRef.current.setLngLat([lng, lat])
      } else {
        markerRef.current = new mapboxgl.Marker({ color: '#ef4444' })
          .setLngLat([lng, lat])
          .addTo(map)
        setHasPin(true)
      }

      onGuessRef.current([lng, lat])
    })

    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current  = null
      markerRef.current = null
    }
  }, [])

  // ResizeObserver on the map container: keeps the canvas exactly in sync
  // with the container during the CSS transition, so clicks are always accurate.
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const ro = new ResizeObserver(() => {
      mapRef.current?.resize()
    })
    ro.observe(el)

    return () => ro.disconnect()
  }, [])

  // Draw result visualisation: dashed line + target marker + fit bounds
  useEffect(() => {
    if (!showResult || !mapRef.current) return
    const map = mapRef.current
    if (!map.isStyleLoaded()) return   // shouldn't happen after 20 s, but guard anyway

    const target: [number, number] = [showResult.targetLng, showResult.targetLat]
    const guess = markerRef.current?.getLngLat()

    // Gold marker for the actual target location
    new mapboxgl.Marker({ color: '#f59e0b' })
      .setLngLat(target)
      .addTo(map)

    if (guess) {
      const guessCoords: [number, number] = [guess.lng, guess.lat]

      // Dashed line from guess → target
      if (!map.getSource('result-line')) {
        map.addSource('result-line', {
          type: 'geojson',
          data: {
            type:     'Feature',
            geometry: { type: 'LineString', coordinates: [guessCoords, target] },
            properties: {},
          },
        })
        map.addLayer({
          id:     'result-line',
          type:   'line',
          source: 'result-line',
          paint: {
            'line-color':     '#fbbf24',
            'line-width':     2,
            'line-dasharray': [4, 3],
            'line-opacity':   0.9,
          },
        })
      }

      // Fit to show both pins
      const bounds = new mapboxgl.LngLatBounds()
      bounds.extend(guessCoords)
      bounds.extend(target)
      map.fitBounds(bounds, { padding: 55, maxZoom: 8, duration: 1_000 })
    } else {
      // No guess — just pan to target
      map.flyTo({ center: target, zoom: 4, duration: 1_000 })
    }
  }, [showResult])

  const { w, h } = SIZES[size]
  // Button is always reserved (48 px) so the panel height stays stable
  const BUTTON_H = 48

  return (
    <div
      ref={panelRef}
      className="absolute bottom-4 right-4 flex flex-col rounded-xl overflow-hidden shadow-2xl border border-stone-200 bg-white transition-[width,height] duration-300 ease-in-out"
      style={{ width: w, height: h + 36 + BUTTON_H }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 shrink-0 h-9 bg-white border-b border-stone-100">
        <span className="text-[11px] font-semibold text-stone-400 uppercase tracking-widest select-none">
          Place your guess
        </span>
        <button
          onClick={() => setSize(s => s === 'small' ? 'expanded' : 'small')}
          className="flex items-center gap-1 text-[11px] font-medium text-stone-400 hover:text-stone-700 transition-colors select-none"
          aria-label={size === 'small' ? 'Expand minimap' : 'Collapse minimap'}
        >
          {size === 'small' ? (
            <>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M7 1h4v4M1 7v4h4M11 1L6.5 5.5M1 11l4.5-4.5"/>
              </svg>
              expand
            </>
          ) : (
            <>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M10 5H6V1M2 7v4h4M6 6L11 1M1 11l5-5"/>
              </svg>
              shrink
            </>
          )}
        </button>
      </div>

      {/* Map — flex-1 so it fills whatever height the panel transition gives it */}
      <div ref={containerRef} className="flex-1 w-full" />

      {/* Guess button — always 48 px tall so panel height never jumps */}
      {!disabled && (
        <button
          onClick={() => { if (hasPin) onSubmitRef.current?.() }}
          disabled={!hasPin}
          style={{ height: BUTTON_H }}
          className={`
            shrink-0 w-full font-bold text-sm tracking-[0.12em] uppercase
            transition-all duration-200 select-none
            ${hasPin
              ? 'bg-green-500 hover:bg-green-400 active:bg-green-600 text-white cursor-pointer'
              : 'bg-stone-100 text-stone-400 cursor-not-allowed'
            }
          `}
        >
          {hasPin ? 'Make Guess →' : 'Place a pin first'}
        </button>
      )}
      {disabled && <div style={{ height: BUTTON_H }} className="shrink-0 bg-stone-50" />}
    </div>
  )
}
