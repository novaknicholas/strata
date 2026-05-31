'use client'

import { useEffect, useRef, useState, useCallback, memo } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!

const EXPANDED_KEY = 'strata_minimap_expanded_size'
const MIN_W = 200, MIN_H = 150
const BTN_H = 44, GAP = 6

interface ResultData { targetLng: number; targetLat: number }
interface MiniMapProps {
  onGuess:     (coords: [number, number]) => void
  onSubmit?:   () => void
  disabled?:   boolean
  showResult?: ResultData
}

function MiniMap({ onGuess, onSubmit, disabled = false, showResult }: MiniMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef       = useRef<mapboxgl.Map | null>(null)
  const markerRef    = useRef<mapboxgl.Marker | null>(null)
  const panelRef     = useRef<HTMLDivElement>(null)
  const mapPanelRef  = useRef<HTMLDivElement>(null)
  const guessBtnRef  = useRef<HTMLElement | null>(null)

  const onGuessRef  = useRef(onGuess)
  const disabledRef = useRef(disabled)
  const onSubmitRef = useRef(onSubmit)
  useEffect(() => { onGuessRef.current  = onGuess  }, [onGuess])
  useEffect(() => { disabledRef.current = disabled }, [disabled])
  useEffect(() => { onSubmitRef.current = onSubmit }, [onSubmit])

  const [hasPin,       setHasPin]       = useState(false)
  const [expanded,     setExpanded]     = useState(false)
  const [isMobile,     setIsMobile]     = useState(false)
  const [dragPos,      setDragPos]      = useState<{ left: number; top: number } | null>(null)
  const [expandedSize, setExpandedSize] = useState({ w: 380, h: 280 })

  const expandedSizeRef = useRef(expandedSize)
  useEffect(() => { expandedSizeRef.current = expandedSize }, [expandedSize])

  // Synced ref so event handlers can read dragPos without stale closure
  const dragPosRef = useRef(dragPos)
  useEffect(() => { dragPosRef.current = dragPos }, [dragPos])

  // ── Resize button (top-left): tap = toggle, drag = resize large ───────────
  // During a drag we do pure DOM manipulation — zero React re-renders, zero WebGL flicker.
  // State is committed in a single batch on pointer-up.
  const resizeRef = useRef<{
    ptrX: number; ptrY: number
    origW: number; origH: number
    origRight: number; origBottom: number   // bottom-right corner of panel (stays fixed)
    isPanelMoved: boolean
    isDragging: boolean
    rafId: number
  } | null>(null)

  // ── Move button (top-right): drag only ────────────────────────────────────
  const moveRef = useRef<{
    ptrX: number; ptrY: number
    origLeft: number; origTop: number
    panelW: number; panelH: number
    isDragging: boolean
  } | null>(null)

  // Mobile breakpoint + load saved expanded size
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640)
    check()
    window.addEventListener('resize', check)
    try {
      const raw = localStorage.getItem(EXPANDED_KEY)
      if (raw) {
        const s = JSON.parse(raw)
        if (s?.w && s?.h) setExpandedSize(s)
      }
    } catch { /* storage blocked */ }
    return () => window.removeEventListener('resize', check)
  }, [])

  // ── Mapbox init ───────────────────────────────────────────────────────────
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

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    let raf = 0
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => mapRef.current?.resize())
    })
    ro.observe(el)
    return () => { ro.disconnect(); cancelAnimationFrame(raf) }
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

  // ── Resize button handlers (top-left) ─────────────────────────────────────
  const onResizeDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault(); e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    const panelRect   = panelRef.current!.getBoundingClientRect()
    const mapPanelRect = mapPanelRef.current?.getBoundingClientRect()
    resizeRef.current = {
      ptrX: e.clientX, ptrY: e.clientY,
      origW: mapPanelRect?.width  ?? expandedSizeRef.current.w,
      origH: mapPanelRect?.height ?? expandedSizeRef.current.h,
      origRight:  panelRect.right,
      origBottom: panelRect.bottom,
      isPanelMoved: dragPosRef.current !== null,
      isDragging: false,
      rafId: 0,
    }
  }, [])

  const onResizeMove = useCallback((e: React.PointerEvent) => {
    if (!resizeRef.current) return
    const dx = e.clientX - resizeRef.current.ptrX
    const dy = e.clientY - resizeRef.current.ptrY
    if (!resizeRef.current.isDragging && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) {
      resizeRef.current.isDragging = true
      // Kill CSS transitions for the duration of the drag
      if (mapPanelRef.current) mapPanelRef.current.style.transition = 'none'
      if (guessBtnRef.current) guessBtnRef.current.style.transition  = 'none'
    }
    if (!resizeRef.current.isDragging) return

    // Diagonal-only: single delta applied equally to W and H
    const delta = -(dx + dy) / 2
    const maxW  = window.innerWidth  - 48
    const maxH  = window.innerHeight - BTN_H - GAP - 32
    const newW  = Math.max(MIN_W, Math.min(maxW, resizeRef.current.origW + delta))
    const newH  = Math.max(MIN_H, Math.min(maxH, resizeRef.current.origH + delta))

    // Pure DOM — no React setState, no WebGL interruption
    if (mapPanelRef.current) {
      mapPanelRef.current.style.width  = `${newW}px`
      mapPanelRef.current.style.height = `${newH}px`
    }
    if (guessBtnRef.current) guessBtnRef.current.style.width = `${newW}px`

    // When panel is left/top anchored (moved from default), keep its bottom-right corner fixed
    // so the resize expands up-left (same natural feel as the default bottom-right anchored state)
    if (resizeRef.current.isPanelMoved && panelRef.current) {
      const totalH  = newH + GAP + BTN_H
      const rawLeft = resizeRef.current.origRight  - newW
      const rawTop  = resizeRef.current.origBottom - totalH
      panelRef.current.style.left = `${Math.max(0, Math.min(window.innerWidth  - newW,    rawLeft))}px`
      panelRef.current.style.top  = `${Math.max(0, Math.min(window.innerHeight - totalH,  rawTop))}px`
    }

    // rAF-debounced map.resize()
    cancelAnimationFrame(resizeRef.current.rafId)
    resizeRef.current.rafId = requestAnimationFrame(() => mapRef.current?.resize())
  }, [])

  const onResizeUp = useCallback(() => {
    if (!resizeRef.current) return
    cancelAnimationFrame(resizeRef.current.rafId)

    if (resizeRef.current.isDragging) {
      const finalW = mapPanelRef.current
        ? parseFloat(mapPanelRef.current.style.width)
        : expandedSizeRef.current.w
      const finalH = mapPanelRef.current
        ? parseFloat(mapPanelRef.current.style.height)
        : expandedSizeRef.current.h
      const newSize = { w: finalW, h: finalH }

      // Re-enable CSS transitions (React re-render restores the proper string)
      if (mapPanelRef.current) mapPanelRef.current.style.transition = ''
      if (guessBtnRef.current) guessBtnRef.current.style.transition  = ''

      // Commit panel position if it was moved (DOM already shows this)
      if (resizeRef.current.isPanelMoved && panelRef.current) {
        setDragPos({
          left: parseFloat(panelRef.current.style.left),
          top:  parseFloat(panelRef.current.style.top),
        })
      }

      // One React commit — DOM already matches, so no visual change
      setExpandedSize(newSize)
      setExpanded(true)

      try { localStorage.setItem(EXPANDED_KEY, JSON.stringify(newSize)) } catch {}
    } else {
      // Pure tap → toggle small ↔ large, reset to default corner position
      setExpanded(v => !v)
      setDragPos(null)
    }
    resizeRef.current = null
  }, [])

  // ── Move button handlers (top-right) ──────────────────────────────────────
  // Transform-based drag (zero React re-renders = no WebGL interruptions).
  // On pointer-up: commit to left/top state in one flush.
  const onMoveDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault(); e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    const rect = panelRef.current!.getBoundingClientRect()
    moveRef.current = {
      ptrX: e.clientX, ptrY: e.clientY,
      origLeft: rect.left, origTop: rect.top,
      panelW: rect.width,  panelH: rect.height,
      isDragging: false,
    }
  }, [])

  const onMoveMove = useCallback((e: React.PointerEvent) => {
    if (!moveRef.current || !panelRef.current) return
    const dx = e.clientX - moveRef.current.ptrX
    const dy = e.clientY - moveRef.current.ptrY
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) moveRef.current.isDragging = true
    if (!moveRef.current.isDragging) return

    const rawLeft = moveRef.current.origLeft + dx
    const rawTop  = moveRef.current.origTop  + dy
    const clampedLeft = Math.max(0, Math.min(window.innerWidth  - moveRef.current.panelW, rawLeft))
    const clampedTop  = Math.max(0, Math.min(window.innerHeight - moveRef.current.panelH, rawTop))

    panelRef.current.style.transform =
      `translate(${clampedLeft - moveRef.current.origLeft}px,${clampedTop - moveRef.current.origTop}px)`
  }, [])

  const onMoveUp = useCallback(() => {
    const m = moveRef.current
    if (m?.isDragging && panelRef.current) {
      const panel = panelRef.current
      const rect  = panel.getBoundingClientRect()
      const clampedLeft = Math.max(0, Math.min(window.innerWidth  - rect.width,  rect.left))
      const clampedTop  = Math.max(0, Math.min(window.innerHeight - rect.height, rect.top))
      panel.style.position  = 'absolute'
      panel.style.left      = `${clampedLeft}px`
      panel.style.top       = `${clampedTop}px`
      panel.style.bottom    = ''
      panel.style.right     = ''
      panel.style.transform = ''
      setDragPos({ left: clampedLeft, top: clampedTop })
    } else if (panelRef.current) {
      panelRef.current.style.transform = ''
    }
    moveRef.current = null
  }, [])

  // ── Layout ────────────────────────────────────────────────────────────────
  const MAP_W = expanded ? expandedSize.w : (isMobile ? 200 : 240)
  const MAP_H = expanded ? expandedSize.h : (isMobile ? 155 : 182)

  const posStyle: React.CSSProperties = dragPos
    ? { position: 'absolute', left: dragPos.left, top: dragPos.top }
    : {
        position: 'absolute',
        bottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))',
        right:  'calc(1rem + env(safe-area-inset-right, 0px))',
      }

  const iconBtn = (extra?: React.CSSProperties): React.CSSProperties => ({
    position: 'absolute', zIndex: 5,
    width: 26, height: 26, borderRadius: 6, padding: 0,
    background:           'rgba(0,0,0,0.55)',
    backdropFilter:       'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    border:    '1px solid rgba(255,255,255,0.11)',
    display:   'flex', alignItems: 'center', justifyContent: 'center',
    touchAction: 'none', userSelect: 'none',
    ...extra,
  })

  return (
    <div
      ref={panelRef}
      style={{ ...posStyle, zIndex: 30, display: 'flex', flexDirection: 'column', gap: GAP }}
    >
      {/* ── Map panel ────────────────────────────────────────────────────── */}
      <div
        ref={mapPanelRef}
        style={{
          position: 'relative', flexShrink: 0,
          width: MAP_W, height: MAP_H,
          borderRadius: 14, overflow: 'hidden',
          border:     '1px solid rgba(255,255,255,0.11)',
          boxShadow:  '0 8px 40px rgba(0,0,0,0.7), 0 2px 6px rgba(0,0,0,0.45)',
          transition: 'width 0.22s cubic-bezier(0.16,1,0.3,1), height 0.22s cubic-bezier(0.16,1,0.3,1)',
        }}
      >

        {/* Mapbox canvas — always at this tree position, never remounted */}
        <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />

        {/* ── Top-left: resize button (tap = toggle, drag = resize large) ─── */}
        {!disabled && (
          <div
            onPointerDown={onResizeDown}
            onPointerMove={onResizeMove}
            onPointerUp={onResizeUp}
            title={expanded ? 'Tap to collapse · Drag to resize' : 'Tap to expand · Drag to resize'}
            style={iconBtn({ top: 7, left: 7, cursor: 'nwse-resize' })}
          >
            {expanded ? (
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none"
                stroke="rgba(255,255,255,0.75)" strokeWidth="1.5">
                <path d="M4 6H1v3M6 4h3V1M1 9l3.5-3.5M9 1L5.5 4.5"/>
              </svg>
            ) : (
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none"
                stroke="rgba(255,255,255,0.75)" strokeWidth="1.5">
                <path d="M6 1h3v3M4 9H1V6M9 1L5.5 4.5M1 9l3.5-3.5"/>
              </svg>
            )}
          </div>
        )}

        {/* ── Top-right: move button (drag only) ──────────────────────────── */}
        {!disabled && (
          <div
            onPointerDown={onMoveDown}
            onPointerMove={onMoveMove}
            onPointerUp={onMoveUp}
            title="Drag to move"
            style={iconBtn({ top: 7, right: 7, cursor: 'grab' })}
          >
            <svg width="8" height="8" viewBox="0 0 8 8" fill="rgba(255,255,255,0.6)">
              <circle cx="2" cy="2" r="1"/><circle cx="6" cy="2" r="1"/>
              <circle cx="2" cy="6" r="1"/><circle cx="6" cy="6" r="1"/>
            </svg>
          </div>
        )}
      </div>

      {/* ── Guess button ──────────────────────────────────────────────────── */}
      {!disabled ? (
        <button
          ref={el => { guessBtnRef.current = el }}
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
            fontSize:             12, fontWeight: 700,
            letterSpacing:        '0.14em',
            textTransform:        'uppercase' as const,
            cursor:               hasPin ? 'pointer' : 'default',
            transition:           'background 0.18s, color 0.18s, width 0.22s cubic-bezier(0.16,1,0.3,1)',
          }}
        >
          {hasPin ? 'Guess →' : 'Place a pin'}
        </button>
      ) : (
        <div
          ref={el => { guessBtnRef.current = el }}
          style={{
            width: MAP_W, height: BTN_H, borderRadius: 10, flexShrink: 0,
            background: 'rgba(0,0,0,0.2)',
            transition: 'width 0.22s cubic-bezier(0.16,1,0.3,1)',
          }}
        />
      )}
    </div>
  )
}

export default memo(MiniMap)
