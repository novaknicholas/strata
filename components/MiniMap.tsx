'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!

const EXPANDED_KEY = 'strata_minimap_expanded_size'
const MIN_W = 200, MIN_H = 150

interface ResultData { targetLng: number; targetLat: number }
interface MiniMapProps {
  onGuess:     (coords: [number, number]) => void
  onSubmit?:   () => void
  disabled?:   boolean
  showResult?: ResultData
}

export default function MiniMap({ onGuess, onSubmit, disabled = false, showResult }: MiniMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef       = useRef<mapboxgl.Map | null>(null)
  const markerRef    = useRef<mapboxgl.Marker | null>(null)
  const panelRef     = useRef<HTMLDivElement>(null)

  const onGuessRef  = useRef(onGuess)
  const disabledRef = useRef(disabled)
  const onSubmitRef = useRef(onSubmit)
  useEffect(() => { onGuessRef.current  = onGuess  }, [onGuess])
  useEffect(() => { disabledRef.current = disabled }, [disabled])
  useEffect(() => { onSubmitRef.current = onSubmit }, [onSubmit])

  const [hasPin,        setHasPin]        = useState(false)
  const [expanded,      setExpanded]      = useState(false)
  const [isMobile,      setIsMobile]      = useState(false)
  const [dragPos,       setDragPos]       = useState<{ left: number; top: number } | null>(null)
  const [expandedSize,  setExpandedSize]  = useState({ w: 380, h: 280 })

  // Keep a ref so resize pointerup can save without stale closure
  const expandedSizeRef = useRef(expandedSize)
  useEffect(() => { expandedSizeRef.current = expandedSize }, [expandedSize])

  // Drag (move) refs
  const dragStartRef = useRef<{ ptrX: number; ptrY: number; origLeft: number; origTop: number } | null>(null)
  const draggingRef  = useRef(false)

  // Resize refs
  const resizeStartRef = useRef<{ ptrX: number; ptrY: number; origW: number; origH: number } | null>(null)

  // Mobile breakpoint + load saved expanded size
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640)
    check()
    window.addEventListener('resize', check)

    try {
      const raw = localStorage.getItem(EXPANDED_KEY)
      if (raw) {
        const saved = JSON.parse(raw)
        if (saved?.w && saved?.h) setExpandedSize(saved)
      }
    } catch { /* storage blocked */ }

    return () => window.removeEventListener('resize', check)
  }, [])

  // ── Mapbox init ───────────────────────────────────────────────────────────
  // containerRef stays at the same React-tree position so the map is never
  // destroyed when toggling expanded / small.
  useEffect(() => {
    if (mapRef.current || !containerRef.current) return
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/outdoors-v12',
      center: [0, 20], zoom: 1.5,
      attributionControl: false,
    })
    map.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-right')
    map.on('load',    () => { map.getCanvas().style.cursor = 'crosshair' })
    map.on('dragend', () => { map.getCanvas().style.cursor = 'crosshair' })
    map.on('click', e => {
      if (disabledRef.current) return
      const { lng, lat } = e.lngLat
      if (markerRef.current) {
        markerRef.current.setLngLat([lng, lat])
      } else {
        markerRef.current = new mapboxgl.Marker({ color: '#ef4444' })
          .setLngLat([lng, lat]).addTo(map)
        setHasPin(true)
      }
      onGuessRef.current([lng, lat])
    })
    mapRef.current = map
    return () => { map.remove(); mapRef.current = null; markerRef.current = null }
  }, [])

  // Sync canvas pixel size on any container resize (expand / drag-resize)
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(() => mapRef.current?.resize())
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // ── Result visualisation ──────────────────────────────────────────────────
  useEffect(() => {
    if (!showResult || !mapRef.current) return
    const map = mapRef.current
    if (!map.isStyleLoaded()) return
    const target: [number, number] = [showResult.targetLng, showResult.targetLat]
    const guess = markerRef.current?.getLngLat()
    new mapboxgl.Marker({ color: '#f59e0b' }).setLngLat(target).addTo(map)
    if (guess) {
      const gc: [number, number] = [guess.lng, guess.lat]
      if (!map.getSource('result-line')) {
        map.addSource('result-line', {
          type: 'geojson',
          data: { type: 'Feature', geometry: { type: 'LineString', coordinates: [gc, target] }, properties: {} },
        })
        map.addLayer({
          id: 'result-line', type: 'line', source: 'result-line',
          paint: { 'line-color': '#fbbf24', 'line-width': 2, 'line-dasharray': [4, 3], 'line-opacity': 0.9 },
        })
      }
      const bounds = new mapboxgl.LngLatBounds()
      bounds.extend(gc); bounds.extend(target)
      map.fitBounds(bounds, { padding: 55, maxZoom: 8, duration: 1_000 })
    } else {
      map.flyTo({ center: target, zoom: 4, duration: 1_000 })
    }
  }, [showResult])

  // ── Move drag (grip icon, small mode only) ────────────────────────────────
  const onGripDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault(); e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    const rect = panelRef.current!.getBoundingClientRect()
    draggingRef.current  = false
    dragStartRef.current = { ptrX: e.clientX, ptrY: e.clientY, origLeft: rect.left, origTop: rect.top }
  }, [])

  const onGripMove = useCallback((e: React.PointerEvent) => {
    if (!dragStartRef.current) return
    const dx = e.clientX - dragStartRef.current.ptrX
    const dy = e.clientY - dragStartRef.current.ptrY
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) draggingRef.current = true
    if (!draggingRef.current) return
    setDragPos({
      left: Math.max(0, dragStartRef.current.origLeft + dx),
      top:  Math.max(0, dragStartRef.current.origTop  + dy),
    })
  }, [])

  const onGripUp = useCallback(() => {
    dragStartRef.current = null; draggingRef.current = false
  }, [])

  // ── Resize drag (top-left corner handle, expanded mode only) ─────────────
  // Panel is anchored bottom-right, so top-left is the free corner.
  // Dragging left/up → bigger; dragging right/down → smaller.
  const onResizeDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault(); e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    resizeStartRef.current = {
      ptrX: e.clientX, ptrY: e.clientY,
      origW: expandedSizeRef.current.w,
      origH: expandedSizeRef.current.h,
    }
  }, [])

  const onResizeMove = useCallback((e: React.PointerEvent) => {
    if (!resizeStartRef.current) return
    const dx  = e.clientX - resizeStartRef.current.ptrX
    const dy  = e.clientY - resizeStartRef.current.ptrY
    const maxW = window.innerWidth  - 48
    const maxH = window.innerHeight - 80
    setExpandedSize({
      w: Math.max(MIN_W, Math.min(maxW, resizeStartRef.current.origW - dx)),
      h: Math.max(MIN_H, Math.min(maxH, resizeStartRef.current.origH - dy)),
    })
  }, [])

  const onResizeUp = useCallback(() => {
    if (resizeStartRef.current) {
      try { localStorage.setItem(EXPANDED_KEY, JSON.stringify(expandedSizeRef.current)) } catch {}
    }
    resizeStartRef.current = null
  }, [])

  // Toggle: always reset drag position so sizing is predictable
  const handleToggle = useCallback(() => {
    setExpanded(v => !v)
    setDragPos(null)
  }, [])

  // ── Dimensions ────────────────────────────────────────────────────────────
  const MAP_W = expanded ? expandedSize.w : (isMobile ? 200 : 240)
  const MAP_H = expanded ? expandedSize.h : (isMobile ? 155 : 182)
  const BTN_H = 44

  // ── Positioning ───────────────────────────────────────────────────────────
  // Expanded always uses default corner (no drag while expanded).
  const posStyle: React.CSSProperties = (!expanded && dragPos)
    ? { position: 'absolute', left: dragPos.left, top: dragPos.top }
    : {
        position: 'absolute',
        bottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))',
        right:  'calc(1rem + env(safe-area-inset-right, 0px))',
      }

  return (
    <div
      ref={panelRef}
      style={{ ...posStyle, zIndex: 30, display: 'flex', flexDirection: 'column', gap: 6 }}
    >
      {/* ── Map panel ────────────────────────────────────────────────────── */}
      <div style={{
        position: 'relative', flexShrink: 0,
        width: MAP_W, height: MAP_H,
        borderRadius: 14,
        overflow: 'hidden',
        border:    '1px solid rgba(255,255,255,0.11)',
        boxShadow: '0 8px 40px rgba(0,0,0,0.7), 0 2px 6px rgba(0,0,0,0.45)',
        transition: expanded ? 'none' : 'width 0.25s cubic-bezier(0.16,1,0.3,1), height 0.25s cubic-bezier(0.16,1,0.3,1)',
      }}>

        {/* Mapbox canvas — fixed tree position, never remounted */}
        <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />

        {/* ── Top-left corner: drag grip (small) or resize handle (expanded) */}
        {!disabled && (
          expanded ? (
            /* Resize handle — drag to grow/shrink expanded panel */
            <div
              onPointerDown={onResizeDown}
              onPointerMove={onResizeMove}
              onPointerUp={onResizeUp}
              title="Drag to resize"
              style={{
                position: 'absolute', top: 7, left: 7, zIndex: 5,
                width: 26, height: 26, borderRadius: 6,
                background:           'rgba(0,0,0,0.55)',
                backdropFilter:       'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                border:    '1px solid rgba(255,255,255,0.10)',
                cursor:    'nwse-resize',
                display:   'flex', alignItems: 'center', justifyContent: 'center',
                touchAction: 'none', userSelect: 'none',
              }}
            >
              {/* Diagonal resize stripes */}
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none"
                stroke="rgba(255,255,255,0.65)" strokeWidth="1.4" strokeLinecap="round">
                <line x1="1" y1="9" x2="9" y2="1"/>
                <line x1="1" y1="5" x2="5" y2="1"/>
                <line x1="5" y1="9" x2="9" y2="5"/>
              </svg>
            </div>
          ) : (
            /* Move grip — drag to reposition the small panel */
            <div
              onPointerDown={onGripDown}
              onPointerMove={onGripMove}
              onPointerUp={onGripUp}
              title="Drag to move"
              style={{
                position: 'absolute', top: 7, left: 7, zIndex: 5,
                width: 26, height: 26, borderRadius: 6,
                background:           'rgba(0,0,0,0.55)',
                backdropFilter:       'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                border:    '1px solid rgba(255,255,255,0.10)',
                cursor:    'grab',
                display:   'flex', alignItems: 'center', justifyContent: 'center',
                touchAction: 'none', userSelect: 'none',
              }}
            >
              {/* 2 × 2 dot grip */}
              <svg width="8" height="8" viewBox="0 0 8 8" fill="rgba(255,255,255,0.6)">
                <circle cx="2" cy="2" r="1"/><circle cx="6" cy="2" r="1"/>
                <circle cx="2" cy="6" r="1"/><circle cx="6" cy="6" r="1"/>
              </svg>
            </div>
          )
        )}

        {/* ── Top-right: expand / collapse button ─────────────────────────── */}
        <button
          onClick={handleToggle}
          title={expanded ? 'Collapse' : 'Expand'}
          style={{
            position: 'absolute', top: 7, right: 7, zIndex: 5,
            width: 26, height: 26, borderRadius: 6, padding: 0,
            background:           'rgba(0,0,0,0.55)',
            backdropFilter:       'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            border:    '1px solid rgba(255,255,255,0.12)',
            cursor:    'pointer',
            display:   'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          {expanded ? (
            /* Inward arrows — collapse */
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none"
              stroke="rgba(255,255,255,0.78)" strokeWidth="1.5">
              <path d="M4 6H1v3M6 4h3V1M1 9l3.5-3.5M9 1L5.5 4.5"/>
            </svg>
          ) : (
            /* Outward arrows — expand */
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none"
              stroke="rgba(255,255,255,0.78)" strokeWidth="1.5">
              <path d="M6 1h3v3M4 9H1V6M9 1L5.5 4.5M1 9l3.5-3.5"/>
            </svg>
          )}
        </button>
      </div>

      {/* ── Guess button ──────────────────────────────────────────────────── */}
      {!disabled ? (
        <button
          onClick={() => { if (hasPin) onSubmitRef.current?.() }}
          disabled={!hasPin}
          style={{
            width: MAP_W, height: BTN_H, flexShrink: 0,
            background:           hasPin ? '#22c55e' : 'rgba(8,8,11,0.72)',
            backdropFilter:       'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border:               hasPin ? 'none' : '1px solid rgba(255,255,255,0.09)',
            borderRadius:         10,
            color:                hasPin ? '#fff' : 'rgba(255,255,255,0.28)',
            fontSize:             12,
            fontWeight:           700,
            letterSpacing:        '0.14em',
            textTransform:        'uppercase' as const,
            cursor:               hasPin ? 'pointer' : 'default',
            transition:           'background 0.18s, color 0.18s, width 0.25s cubic-bezier(0.16,1,0.3,1)',
          }}
        >
          {hasPin ? 'Guess →' : 'Place a pin'}
        </button>
      ) : (
        <div style={{
          width: MAP_W, height: BTN_H, borderRadius: 10, flexShrink: 0,
          background: 'rgba(0,0,0,0.2)',
          transition: 'width 0.25s cubic-bezier(0.16,1,0.3,1)',
        }} />
      )}
    </div>
  )
}
