'use client'

import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'

const BAR_WIDTH_PX = 168
const SEGMENTS     = 4     // alternating dark / white

function formatDistance(metres: number): string {
  if (metres >= 1_000) {
    const km = metres / 1_000
    if (km >= 100) return `${Math.round(km)} km`
    // snap to nearest 0.5 km when < 100, nearest 1 km when < 10
    return `${(Math.round(km * 2) / 2).toFixed(km < 10 ? 1 : 0)} km`
  }
  if (metres >= 100) return `${Math.round(metres / 10) * 10} m`
  return `${Math.round(metres)} m`
}

interface ScaleBarProps {
  map: mapboxgl.Map
}

export default function ScaleBar({ map }: ScaleBarProps) {
  const labelRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    // Write directly to the DOM — no React state, no re-renders.
    // The map fires 'zoom' and 'move' at ~60 fps during the 20-second animation;
    // calling setLabel on every event would trigger ~1 200 React renders and
    // compete with Mapbox's own frame budget, causing visible jank.
    function update() {
      if (!labelRef.current) return
      const { lat } = map.getCenter()
      const zoom    = map.getZoom()
      // Mapbox GL JS uses 512 px tiles, so the constant is half the classic 256 px value.
      // mpp = (2π × R_earth × cos(lat)) / (512 × 2^zoom)
      const mpp     = (78_271.517 * Math.cos((lat * Math.PI) / 180)) / 2 ** zoom
      labelRef.current.textContent = formatDistance(mpp * BAR_WIDTH_PX)
    }
    update()
    map.on('zoom', update)
    map.on('move', update)
    return () => {
      map.off('zoom', update)
      map.off('move', update)
    }
  }, [map])

  return (
    <div
      className="absolute pointer-events-none select-none"
      style={{
        bottom: 'calc(20px + env(safe-area-inset-bottom, 0px))',
        left:   'calc(16px + env(safe-area-inset-left, 0px))',
        zIndex: 10,
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start' }}>

        {/* Distance label — updated via ref, never causes a React render */}
        <span
          ref={labelRef}
          style={{
            color:              '#ffffff',
            fontSize:           11,
            fontWeight:         700,
            letterSpacing:      '0.07em',
            textShadow:         '0 1px 4px rgba(0,0,0,.95)',
            fontVariantNumeric: 'tabular-nums',
            lineHeight:         1,
          }}
        >
          —
        </span>

        {/* Alternating-stripe scale bar */}
        <div
          style={{
            width:        BAR_WIDTH_PX,
            height:       13,
            display:      'flex',
            borderRadius: 2,
            overflow:     'hidden',
            border:       '1.5px solid rgba(255,255,255,0.88)',
            boxShadow:    '0 2px 10px rgba(0,0,0,.8)',
          }}
        >
          {Array.from({ length: SEGMENTS }).map((_, i) => (
            <div
              key={i}
              style={{
                flex:       1,
                background: i % 2 === 0 ? '#111111' : '#ffffff',
              }}
            />
          ))}
        </div>

      </div>
    </div>
  )
}
