import mapboxgl from 'mapbox-gl'

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!

export const MAIN_MAP_KEY = 'strata-main'
export const MINI_MAP_KEY = 'strata-mini'

/**
 * Construct the main satellite map. Shared by MapPrewarm (menu-time
 * creation, world view) and GameMap (direct creation fallback) so the
 * configuration lives in exactly one place.
 */
export function createMainMap(
  el:     HTMLDivElement,
  center: [number, number],
  zoom:   number,
): mapboxgl.Map {
  // Tile cache must hold the entire warmed pyramid (≈16 levels incl. the
  // result-globe floors); the pyramid scales with the viewport.
  const tilesPerLevel =
    (Math.ceil(el.clientWidth  / 256) + 2) *
    (Math.ceil(el.clientHeight / 256) + 2)
  const cacheTiles = Math.ceil(tilesPerLevel * 16 * 1.3)

  const map = new mapboxgl.Map({
    container:          el,
    style:              'mapbox://styles/mapbox/satellite-v9',
    center,
    zoom,
    interactive:        false,
    attributionControl: false,
    // Symbols-only option; raster fade is zeroed on style.load below.
    fadeDuration:       0,
    logoPosition:       'bottom-right',
    maxTileCacheSize:   cacheTiles,
  })

  // CRITICAL — two private-API patches on every source cache.
  // PRIVATE API — verified against mapbox-gl 3.24; re-verify on upgrade.
  //
  // 1. Cache size: Mapbox hard-clamps each source's tile LRU to
  //    viewportTiles×5 (≈40 tiles) in SourceCache#updateCacheSize — the
  //    maxTileCacheSize option is Math.min'ed against that and can only
  //    SHRINK the cache. 40 tiles cannot hold the warmed pyramid, so every
  //    preloaded level was evicted before the animation displayed it,
  //    re-fetching live (mixed-vintage tile rectangles mid-flight).
  //    Override updateCacheSize to pin a size that holds the full pyramid.
  //
  // 2. Fade retention: with raster-fade-duration 0, Tile#registerFadeDuration
  //    computes fadeEndTime = timeAdded + 0 < now and EARLY-RETURNS without
  //    setting fadeEndTime. SourceCache#update treats an undefined
  //    fadeEndTime as "still fading" forever, and permanently retains every
  //    loaded DESCENDANT of every ideal tile — which the painter then draws
  //    on top (stencil prefers higher-res). Result: a centre rectangle of
  //    different imagery vintage at low zooms. _supportsFading = false
  //    skips that whole retention block; with zero fade there is nothing to
  //    fade anyway, and edges keep their instant full-vibrancy appearance.
  map.on('style.load', () => {
    type SC = {
      updateCacheSize: () => void
      _cache: { setMaxSize: (n: number) => void }
      _supportsFading: boolean
    }
    const style  = (map as unknown as { style?: { _sourceCaches?: Record<string, SC> } }).style
    const caches = style?._sourceCaches ?? {}
    for (const key of Object.keys(caches)) {
      const sc = caches[key]
      sc.updateCacheSize = function (this: SC) { this._cache.setMaxSize(cacheTiles) }
      sc._cache.setMaxSize(cacheTiles)
      sc._supportsFading = false
    }
  })

  // THE raster fade fix. Mapbox restarts a tile's fade-from-transparent
  // whenever it (re-)enters the render set — even warmed, cached tiles. At
  // the expanding edge of a zoom-out nothing renders beneath the fading
  // tile, so satellite-v9's default raster-fade-duration of 300 ms paints a
  // translucent ring regardless of preloading (and regardless of the
  // Map-level fadeDuration option, which is symbols-only).
  map.on('style.load', () => {
    for (const layer of map.getStyle()?.layers ?? []) {
      if (layer.type === 'raster') {
        map.setPaintProperty(layer.id, 'raster-fade-duration', 0)
      }
    }
  })
  map.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-left')
  if (process.env.NODE_ENV !== 'production') {
    ;(window as unknown as Record<string, unknown>).__strataMap = map
  }
  return map
}

/** Construct the minimap (world guess map). */
export function createMiniMap(el: HTMLDivElement): mapboxgl.Map {
  const map = new mapboxgl.Map({
    container:          el,
    style:              'mapbox://styles/mapbox/outdoors-v12',
    center:             [0, 20],
    zoom:               1.5,
    attributionControl: false,
  })
  map.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-right')
  map.on('load',    () => { map.getCanvas().style.cursor = 'crosshair' })
  map.on('dragend', () => { map.getCanvas().style.cursor = 'crosshair' })
  return map
}
