import type mapboxgl from 'mapbox-gl'

interface Holder {
  el:  HTMLDivElement
  map: mapboxgl.Map
}

const holders = new Map<string, Holder>()

/**
 * Mount a tab-lifetime Mapbox instance into `parent`.
 *
 * The Map is constructed exactly once per key, inside a holder div this
 * module owns. When the React component unmounts we DETACH the holder from
 * the DOM (detachPersistentMap) instead of calling map.remove(), and the
 * next mount re-appends it. Mapbox map-load API credits are charged per
 * `new Map()` construction, so this caps the cost at one credit per key for
 * the whole tab session — and the tile cache survives across games, making
 * every round after the first dramatically faster to warm.
 */
export function mountPersistentMap(
  key:    string,
  parent: HTMLElement,
  create: (container: HTMLDivElement) => mapboxgl.Map,
): { map: mapboxgl.Map; created: boolean } {
  const existing = holders.get(key)
  if (existing) {
    parent.appendChild(existing.el)
    existing.map.resize()
    return { map: existing.map, created: false }
  }
  const el = document.createElement('div')
  el.style.cssText = 'position:absolute;inset:0;width:100%;height:100%'
  parent.appendChild(el)
  const holder = { el, map: create(el) }
  holders.set(key, holder)
  return { map: holder.map, created: true }
}

/** Detach (NOT destroy) the map's canvas so the React component can unmount. */
export function detachPersistentMap(key: string): void {
  holders.get(key)?.el.remove()
}
