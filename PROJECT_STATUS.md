# Strata — Project Status

GeoGuessr-style geography guessing game. A satellite map loads zoomed in on a mystery location, then slowly zooms out over 20 seconds. The player places a pin on a world minimap and submits their guess. Scored on distance accuracy + speed.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16.2.6 (App Router, Turbopack) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS v4 |
| Main map | Mapbox GL JS v3.24 — `satellite-v9` style |
| Minimap | Mapbox GL JS v3.24 — `outdoors-v12` style |
| Geography | world-atlas, topojson-client, @turf/random, @turf/boolean-point-in-polygon |
| React | React 19.2 / React DOM 19.2 |

**Environment variable required:**
```
NEXT_PUBLIC_MAPBOX_TOKEN=pk.ey...
```
Stored in `.env.local` (gitignored via `.env*` pattern). Never write the token to any source file. `pk.*` tokens are public-by-design; restrict them in the Mapbox dashboard by URL.

---

## File Structure

```
strata/
├── app/
│   ├── layout.tsx          # Root layout — Geist font, viewport viewportFit:'cover' for iPhone safe areas
│   ├── page.tsx            # Session manager: menu → playing → summary state machine
│   └── globals.css         # Attribution control positioning, @keyframes slideUp/fadeIn
│
├── components/
│   ├── GameWrapper.tsx     # Round orchestrator — timer, phase state, scoring, keyboard shortcuts
│   ├── GameMap.tsx         # Satellite main map — persistent Mapbox instance, zoom-out animation
│   ├── MiniMap.tsx         # World guess map — persistent Mapbox instance, drag/resize/move
│   ├── HUD.tsx             # Top-centre pill: round dots + countdown timer
│   ├── ScaleBar.tsx        # Bottom-left scale bar — DOM-direct updates (no React state on map events)
│   ├── ResultOverlay.tsx   # Per-round result card — score count-up, distance, location name
│   ├── SummaryOverlay.tsx  # End-of-game overlay — all 5 rounds, animated total, grade, share
│   ├── MainMenu.tsx        # Deep-space satellite bento menu — 4×4 grid, popularity badges, accent
│   ├── MapPrewarm.tsx      # Behind the menu — creates both tab-lifetime maps during mode select
│   └── StartScreen.tsx     # Intro screen — title, difficulty selector, personal best
│
├── lib/
│   ├── types.ts            # GameMode union, GameLocation interface, RoundResult interface
│   ├── getGameLocation.ts  # Mode router — returns GameLocation for any mode
│   ├── haversine.ts        # haversineKm(), calcScore(), zoomForDistance()
│   ├── createMaps.ts       # Shared Mapbox constructors (main satellite + minimap) + cache/fade patches
│   ├── persistentMap.ts    # Tab-lifetime map holders — mount/detach, never remove()
│   ├── randomLandPoint.ts  # Terra mode — rejection-sample random land coordinate
│   ├── randomUnchartedPoint.ts  # Uncharted mode — random point excluding urban areas
│   ├── randomUrbanPoint.ts # Legacy (unused — urban mode now uses cities50k.json)
│   └── data/
│       ├── cities50k.json  # 12,181 cities >50k pop — [name, lat, lng, cc][]  (429 KB)
│       ├── islands.json    # 3,132 island settlements — [name, lat, lng, cc][]  (109 KB)
│       ├── usa.json        # 974 US cities — [name, lat, lng, cc][]  (36 KB)
│       ├── europe.json     # 6,995 European cities — [name, lat, lng, cc][]  (247 KB)
│       ├── mountains.json  # 16,308 mountain peaks — [lat, lng][]  (220 KB, no names)
│       ├── volcanoes.json  # 793 volcanoes — [lat, lng][]  (12 KB, no names)
│       ├── airports.json   # 1,160 large civilian airports — [name, lat, lng, cc, municipality][]  (81 KB)
│       └── landmarks.json  # 80 handcrafted landmarks — [name, lat, lng][]  (3 KB)
│
├── scripts/
│   └── capture-tiles.mjs   # One-time HD satellite tile capture (Mapbox Static Images API → sharp)
│
├── public/images/          # 10 HD satellite tile JPGs for MainMenu (iconic location per mode)
│
├── CHANGELOG.txt           # Reverse-chronological change log
├── PROJECT_STATUS.md       # This file
├── CLAUDE.md / AGENTS.md   # AI assistant notes (points to Next.js docs caveat)
└── .env.local              # Mapbox token — gitignored, never commit
```

---

## Game Modes

All 10 modes share the same round loop. `getGameLocation(mode)` returns a `GameLocation { lat, lng, name?, country? }`.

### Modes using static JSON (no reverse-geocoding)

| Mode | Data Source | JSON Format | Entry count | Result label |
|---|---|---|---|---|
| **Urban** | GeoNames cities15000, filtered >50k pop | `[name, lat, lng, cc][]` | 12,181 | "Paris, FR" |
| **Islands** | GeoNames island/islet features | `[name, lat, lng, cc][]` | 3,132 | "Honolulu, US" |
| **USA** | GeoNames, US only | `[name, lat, lng, cc][]` | 974 | "Denver, US" |
| **Europe** | GeoNames, European countries | `[name, lat, lng, cc][]` | 6,995 | "Vienna, AT" |
| **Mountains** | OpenStreetMap mountain peaks | `[lat, lng][]` | 16,308 | "Mountain Peak" (static) |
| **Volcanoes** | Smithsonian GVP | `[lat, lng][]` | 793 | "Volcanic Peak" (static) |
| **Airports** | OurAirports airports.csv, large_airport type, civilian only | `[name, lat, lng, cc, municipality][]` | 1,160 | "Logan International Airport, US" |
| **Landmarks** | Handcrafted JSON of 80 iconic locations | `[name, lat, lng][]` | 80 | "Eiffel Tower" |

Mountains and Volcanoes use a static label because adding names would require re-downloading the full GeoNames `allCountries` dataset (1.8 GB).

### Modes using Mapbox Geocoding API (reverse-geocode on result)

| Mode | How location is chosen | API call |
|---|---|---|
| **Terra** | `randomLandPoint()` — rejection-sample against world-atlas landmass polygon | 1× Mapbox Geocoding v5 per round |
| **Uncharted** | `randomUnchartedPoint()` — random point excluding dense urban zones | 1× Mapbox Geocoding v5 per round |

Geocoding only fires when `target.name` is absent. All 8 static-JSON modes skip the API entirely.

---

## Map Reuse Architecture (roundKey System)

### Problem solved
Naively using `key={roundKey}` on `GameWrapper` forced full React remount each round — destroying and recreating both Mapbox instances. Cost: 2 Mapbox Map Load events per round = 10 per 5-round game.

### Solution
`roundKey` is passed as a regular **prop** (not a React key). Maps are created once in `useEffect([], [])` (Effect A) and reset in-place each round.

**Render sequence on round advance:**
1. `page.tsx` increments `roundKey` and `currentRound`
2. React renders `GameWrapper` with new `roundKey` — props unchanged for `GameMap`/`MiniMap`
3. `GameWrapper`'s `useEffect([roundKey])` fires → calls `setTarget(newLoc)`, `setPhase('loading')`, etc. — batched into render #2
4. `GameMap`'s `useEffect([target])` (Effect B) fires in render #2 with the new coordinates:
   - `map.stop()` — cancels ongoing animations
   - Removes result marker
   - `map.jumpTo({ center: newCoords, zoom: 16 })` — instant, covered by loading screen
   - `triggerAnimation(map)` — re-arms the tile preload waterfall + idle listener
5. `MiniMap`'s `useEffect([roundKey])` fires in render #1:
   - `map.stop()` — cancels any ongoing `fitBounds`/`flyTo` from result phase
   - Removes guess marker, answer marker, result line
   - `map.jumpTo({ center: [0,20], zoom: 1.5 })` — instant world view

**Key timing insight:** Effect B is on `[target]` (not `[roundKey]`) so it fires in render #2 — after `setTarget(newLoc)` has committed. If it were on `[roundKey]`, it would read stale coordinates from render #1.

**Cost:** 2 Map Load events per full game session (menu → play → summary). A new game after returning to menu costs another 2 (GameWrapper unmounts when `gamePhase === 'menu'`).

---

## Scoring

```
accuracy   = 3000 × exp(−√distanceKm / 30)     // 0–3000
multiplier = 1 + (1 − timeTakenSec / duration)  // 1.0–2.0 (instant doubles score)
score      = min(6000, round(accuracy × multiplier))
```

Per-round max: **6,000**. 5-round game max: **30,000**.

Representative values (instant guess):

| Distance | Score |
|---|---|
| 5 km | 5,570 |
| 50 km | 4,740 |
| 200 km | 3,744 |
| 500 km | 2,848 |
| 1,000 km | 2,113 |
| 3,000 km | 966 |

Divisor was tuned from 20 → 30 to make mid-range guesses feel rewarding.

---

## API Cost Optimizations

### Mapbox Map Loads
- **Originally:** `key={roundKey}` on GameWrapper → full remount → 2 loads/round → 10 loads/game
- **Then:** persistent instances per game session → 2 loads per game
- **Now:** tab-lifetime singletons (`lib/persistentMap.ts`) → **2 loads per tab, total**, however many games are played

### Mapbox Geocoding (Reverse-Geocode)
- **Before:** Every mode called Mapbox Geocoding API every round
- **After:** Only Terra and Uncharted call the API. All other 8 modes carry a `name` field in their JSON — `getGameLocation` returns `{ name, lat, lng, country? }` and `GameWrapper` short-circuits the geocoding fetch when `target.name` is present
- **Reduction:** ~80% fewer geocoding API calls

### No additional tile costs
Tile requests are included within the Mapbox Map Load session — prefetching and `maxTileCacheSize` do not incur additional charges.

---

## Map Persistence (tab-lifetime singletons)

Both Mapbox instances are **constructed once per tab** via `lib/persistentMap.ts`: the Map lives in a module-owned holder div; React unmounts only *detach* the holder from the DOM (never `map.remove()`), and the next mount re-appends it and calls `map.resize()`. Consequences:

- **2 map-load credits per tab total** (main + minimap), no matter how many games are played.
- **Tile caches survive across games** — continental-scale tiles warmed in game 1 round 1 are still cached in game 5; warming gets faster the longer the tab lives.
- Event handlers that capture per-component-instance refs (MiniMap's click handler) are rebound on every mount and removed on unmount. Markers/lines are cleaned up on unmount *before* detaching, and again defensively on reattach.

## Zoom-Out Animation

The main map zooms from zoom 16 → 3.5 over **30 seconds (the full round)** using `map.easeTo()` with a custom Catmull-Rom easing function through waypoints `[16, 14, 11, 6, 3.5]`. The slower zoom doubles as loading slack — each tile level stays on screen longer, so any straggler tile resolves long before it nears the screen edge.

### Easing function
```ts
// Reflect boundary: p(-1)=p(1), p(n+1)=p(n-1)
// Gives zero zoom velocity at t=0 and t=1 — no jerk at start or end
const p = (j) => j < 0 ? ZOOMS[-j] : j > n ? ZOOMS[2*n - j] : ZOOMS[j]
```

The `zoomEasing(t)` function maps t→[0,1] so `easeTo` linearly interpolates zoom space, but the camera follows the Catmull-Rom curve.

### Two-phase animation + drift (original drift restored)
The 30s animation is **two chained `easeTo` calls split at the z6 spline knot** (t = 0.75 → 22.5s). Each phase replays its part of the same Catmull-Rom spline (`zoomEasingMain` / `zoomEasingDrift`), so the combined zoom trajectory — including velocity at the seam — is identical to a single-easeTo version.

- **Main phase (0–22.5s):** pure centred zoom-out, z16 → z6.
- **Drift phase (22.5–30s):** z6 → z3.5 panning to a per-round random end centre offset by up to **±3° lng / ±2° lat** from the target (uniform, lat clamped to ±85°). A few percent of the continental viewport — subtle, but the answer is never pinned to the exact centre of the screen.

The drift-phase starter lives in `driftTimerRef` and is cleared on round reset, unmount, and when `frozen` becomes true (a guess made before 22.5s would otherwise let the pending drift `easeTo` yank the camera during the result view). `easeTo` always starts from the live camera state, so the chain seam cannot jump even if timing is a few ms off.

### Warm-then-animate loader (floor-first)
Behind the loading screen, `triggerAnimation` visits a **priority-ordered** list of camera states and advances when `map.areTilesLoaded()` reports ready (faster than waiting for `idle`):

1. **END state** (z3.5 @ drifted centre) — the **no-black floor**. The continental end viewport geographically contains every frame of the flight, so once its tiles are cached, every later frame has a loaded ancestor and black tiles are structurally impossible — on any connection.
2. **START view** (z16 @ target) — the opening frame, sharp.
3. **Half-zoom pyramid fill**, 15.5 → 4.5 in consumption order, each centred on the camera's actual position when that level displays widest. (Raster sources *round* fractional zoom, so z = N−0.5 is a level's widest display moment; during the drift phase the centre interpolates toward `endCenter`.)
4. **Frozen-reveal floor** (z2.5, z1.8) — the levels shown by the result-screen globe zoom.

An **adaptive 4-second cap** (`LOAD_CAP_MS`) covers the whole list: normal connections finish everything (guaranteed-perfect animation); slow connections start anyway, and because the list is priority-ordered, a truncation can only cost the lowest-priority tail — never the floor. The cap **re-arms while `document.hidden`** (rAF is frozen in hidden tabs, so the warm can't advance — burning the cap would start the round cold). Cancellation is by sequence token (`loadSeqRef`), checked by every async step.

**Three hard-won implementation facts (do not regress these):**
1. **`areTilesLoaded()` must not be checked synchronously after `jumpTo`** — tile coverage updates on the *next render*, so a synchronous check reads the previous viewport's state (all loaded) and skips the stop entirely. The first check is gated behind one `'render'` event, with `triggerRepaint()` to guarantee a render for fully-cached stops.
2. **Mapbox hard-clamps each source's tile LRU to viewportTiles×5 (≈40 tiles)** in `SourceCache#updateCacheSize`; the public `maxTileCacheSize` option is `Math.min`'ed against it and can only shrink the cache. 40 tiles cannot hold a 16-level pyramid, so warmed tiles were silently evicted before display and re-fetched mid-animation (visible as mixed-vintage rectangles — different zoom levels have different imagery color grading). `createMainMap` overrides the private `updateCacheSize` per source cache on `style.load` to pin `tilesPerLevel × 16 × 1.3`.
3. **`raster-fade-duration: 0` triggers permanent descendant retention.** `Tile#registerFadeDuration(0)` early-returns without setting `fadeEndTime`; `SourceCache#update` treats undefined `fadeEndTime` as "still fading" forever and permanently retains every loaded descendant of every ideal tile, which the painter draws on top (stencil prefers higher-res) — a centre rectangle of different imagery vintage at low zooms. Fixed by setting `_supportsFading = false` per source cache, which skips the fade-retention machinery entirely (with zero fade there is nothing to fade).

**Both private-API patches live in `createMainMap`'s `style.load` handler — verified against mapbox-gl 3.24; re-verify on any mapbox-gl upgrade.**

Because the map is tab-lifetime, rounds after the first reuse continental tiles. `MapPrewarm` (rendered behind the menu) creates both maps during mode selection, so style/worker init and the world floor are already done when round 1 begins. Large screens follow the GeoGuessr model: native quality, proportionally larger cache, no artificial downscaling. Warm telemetry logs to the console as `[strata] warm stop N/16 …` in dev.

**`maxTileCacheSize` is computed from canvas size at map construction** — `(w/256+2)·(h/256+2) × 14 levels × 1.3 margin` (~1,270 tiles on 1080p, ~3,400 on 4K, ~440 on a phone). The cache must hold the *entire* warmed pyramid until the animation consumes it; any fixed value silently re-introduces LRU eviction (= black edges) on screens larger than it was tuned for. (Zoom-*in* never has this problem: it only reveals areas already covered by loaded parent tiles. Zoom-*out* reveals virgin area every frame and depends entirely on the warmed cache surviving.)

**Raster fade is zeroed via the `raster-fade-duration` paint property — NOT the Map `fadeDuration` option.** The Map-level `fadeDuration` only affects symbol/label fading; raster tile fade is a paint property on the raster layer, and satellite-v9 ships with a 300ms default. Mapbox restarts a tile's fade-from-transparent whenever it (re-)enters the render set — *even warmed, cached tiles* — and at the expanding edge of a zoom-out nothing renders beneath the fading tile, so that default painted a translucent ring at the screen edges regardless of preloading. `GameMap` zeroes `raster-fade-duration` on every raster layer in a `style.load` handler. If a straggler tile ever pops visibly on a bad connection, the dial is a small value on this paint property (~100ms), never 300+.

**Drift magnitude:** ±3° lng / ±2° lat (uniform, per round) — a few percent of the continental-scale end viewport; subtle, but the answer is never pinned to the exact centre of the screen.

A named-function sequential waterfall (not nested `once()` callbacks) is used so `activeVisitorRef` can cancel an in-flight waterfall when Effect B resets the map for a new round.

**Map constructor options that support smooth animation:**
- `fadeDuration: 300` — tiles fade in over 300ms instead of popping in
- `maxTileCacheSize: 300` — keeps pre-warmed tiles resident during the 20s animation

### ScaleBar performance fix
ScaleBar used to call `setLabel()` (React state) on every `zoom` and `move` event — ~1,200 React re-renders during the 20s animation. Now uses `labelRef.current.textContent =` (direct DOM write) — zero React renders.

---

## Timer — Tab Visibility

The game timer pauses when the browser tab is hidden and resumes when it returns. Without this, `Date.now()`-based elapsed time would accumulate while the tab was hidden, causing the round to auto-expire the moment the user switched back.

**Implementation in `GameWrapper`:**
- `pausedAtRef` stores the timestamp when the tab was hidden (during 'playing' phase only)
- On `visibilitychange` → hidden: clears the interval, saves `Date.now()`
- On `visibilitychange` → visible: shifts `gameStartTimeRef` forward by the hidden duration, restarts interval
- `startTicking()` — extracted shared callback used by both `handleMapReady` and the visibility resumption

---

## Bug Fixes Implemented

| Bug | Root cause | Fix |
|---|---|---|
| Stale target coordinates (round 2+) | Effect B had `[roundKey]` deps — fired in render #1 before `setTarget` committed | Changed deps to `[target]` — fires in render #2 |
| Orange answer pin visible in new round | MiniMap `flyTo({duration:800})` still animating when loading screen lifted | Changed to `jumpTo` (instant) |
| MiniMap shows previous answer during new round | `fitBounds`/`flyTo` from result phase wasn't cancelled before `jumpTo` in round reset | Added `map.stop()` before `jumpTo` in MiniMap's `[roundKey]` effect |
| Timer expiring while tab hidden | `Date.now()` elapsed time accumulated while tab was invisible | `visibilitychange` listener pauses/resumes interval |
| Zoom animation jerk at start/end | Catmull-Rom clamp boundary gave non-zero tangent (dz/dt = ±4–5 at endpoints) | Reflect boundary: `p(-1)=p(1)`, `p(n+1)=p(n-1)` → zero endpoint velocity |
| Tile pop-in during zoom-out | `fadeDuration: 0` — tiles appeared instantly when loaded | Changed to `fadeDuration: 300` |
| ScaleBar causing animation jank | `setLabel()` fired ~1,200 React re-renders during 20s animation | Direct `labelRef.current.textContent` write |

---

## Security Constraints

- **Never write the Mapbox token to any source file.** It must only be set via `.env.local`.
- `.env.local` is gitignored via the `.env*` pattern in `.gitignore`.
- `pk.*` tokens are public-by-design (Mapbox architecture) — restrict by URL allowlist in the Mapbox dashboard.
- If Supabase is added later: the **service role key must never use the `NEXT_PUBLIC_` prefix** — it is server-side only and would be exposed to all clients if prefixed.

---

## What's Built

- [x] 10 fully wired game modes with distinct location datasets
- [x] 5-round game loop with running total and summary screen
- [x] Difficulty selector (30s / 20s / 10s)
- [x] Score system with distance + time multiplier
- [x] Persistent Mapbox instances (2 loads per game)
- [x] Tile preload waterfall for smooth zoom-out animation
- [x] Personal best tracking (localStorage)
- [x] Share button (clipboard copy)
- [x] Mobile-responsive layout with iPhone safe-area support
- [x] MiniMap resize/drag/expand
- [x] Tab-visibility timer pause
- [x] Keyboard shortcuts (Enter to submit / advance)
- [x] 80% Geocoding API reduction

## What's Not Yet Built / Possible Next Steps

- [ ] **Leaderboard / multiplayer** — no backend yet; would require Supabase or similar
- [ ] **Daily challenge mode** — fixed seed per day, shareable score
- [ ] **Named mountain/volcano locations** — needs GeoNames `allCountries` (1.8 GB download)
- [ ] **Streak / XP system** — no persistence beyond localStorage personal best
- [ ] **More game modes** — potential: rivers, capitals, national parks, flags
- [ ] **Deployment** — not yet deployed; `npm run build` + Vercel would be the path
- [ ] **Authentication** — no user accounts
