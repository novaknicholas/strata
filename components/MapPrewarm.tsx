'use client'

import { useEffect, useRef } from 'react'
import 'mapbox-gl/dist/mapbox-gl.css'
import { mountPersistentMap, detachPersistentMap } from '@/lib/persistentMap'
import { createMainMap, createMiniMap, MAIN_MAP_KEY, MINI_MAP_KEY } from '@/lib/createMaps'

/**
 * Rendered behind the main menu. Creates (or keeps attached) both
 * tab-lifetime maps while the player is still choosing a mode, so by the
 * time a round starts:
 *   - style, workers, sprites and glyphs are fully initialised
 *   - the main map has the world-scale globe tiles cached (z1.8 floor)
 *   - the minimap's entire world view is cached (its whole gameplay view)
 * Round 1's warm sequence then starts hot instead of cold.
 */
export default function MapPrewarm() {
  const mainRef = useRef<HTMLDivElement>(null)
  const miniRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!mainRef.current || !miniRef.current) return
    mountPersistentMap(MAIN_MAP_KEY, mainRef.current, el => createMainMap(el, [0, 20], 1.8))
    mountPersistentMap(MINI_MAP_KEY, miniRef.current, el => createMiniMap(el))
    return () => {
      detachPersistentMap(MAIN_MAP_KEY)
      detachPersistentMap(MINI_MAP_KEY)
    }
  }, [])

  // Behind the opaque menu; kept at natural size so the cache-size
  // computation and tile coverage match real gameplay dimensions.
  return (
    <div aria-hidden style={{ position: 'fixed', inset: 0, zIndex: -1, pointerEvents: 'none' }}>
      <div ref={mainRef} style={{ position: 'absolute', inset: 0 }} />
      <div ref={miniRef} style={{ position: 'absolute', right: 0, bottom: 0, width: 240, height: 182 }} />
    </div>
  )
}
