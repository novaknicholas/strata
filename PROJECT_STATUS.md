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
│   ├── MainMenu.tsx        # Mode selection grid (2×5, 10 tiles)
│   └── StartScreen.tsx     # Intro screen — title, difficulty selector, personal best
│
├── lib/
│   ├── types.ts            # GameMode union, GameLocation interface, RoundResult interface
│   ├── getGameLocation.ts  # Mode router — returns GameLocation for any mode
│   ├── haversine.ts        # haversineKm(), calcScore(), zoomForDistance()
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
├── public/images/          # 10 JPG tile images for MainMenu (one per mode)
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
- **Before:** `key={roundKey}` on GameWrapper → full remount → 2 loads/round → 10 loads/game
- **After:** Persistent instances, in-place reset → **2 loads per game session**

### Mapbox Geocoding (Reverse-Geocode)
- **Before:** Every mode called Mapbox Geocoding API every round
- **After:** Only Terra and Uncharted call the API. All other 8 modes carry a `name` field in their JSON — `getGameLocation` returns `{ name, lat, lng, country? }` and `GameWrapper` short-circuits the geocoding fetch when `target.name` is present
- **Reduction:** ~80% fewer geocoding API calls

### No additional tile costs
Tile requests are included within the Mapbox Map Load session — prefetching and `maxTileCacheSize` do not incur additional charges.

---

## Zoom-Out Animation

The main map zooms from zoom 16 → 3.5 over 20 seconds using `map.easeTo()` with a custom Catmull-Rom easing function through waypoints `[16, 14, 11, 6, 3.5]`.

### Easing function
```ts
// Reflect boundary: p(-1)=p(1), p(n+1)=p(n-1)
// Gives zero zoom velocity at t=0 and t=1 — no jerk at start or end
const p = (j) => j < 0 ? ZOOMS[-j] : j > n ? ZOOMS[2*n - j] : ZOOMS[j]
```

The `zoomEasing(t)` function maps t→[0,1] so `easeTo` linearly interpolates zoom space, but the camera follows the Catmull-Rom curve.

### Tile preload waterfall
During the loading screen, before the game starts, `triggerAnimation` visits each animation waypoint zoom level sequentially to pre-cache tiles:

```
z16 idle → jumpTo(z14) → idle → jumpTo(z11) → idle → jumpTo(z6) → idle → jumpTo(z3.5) → idle → jumpTo(z16) → startAnim()
```

All jumps happen while the loading screen is up (user sees only the spinner). Lower zoom tiles are CDN-warm large-area tiles; each step typically takes <500ms. Total extra loading: ~1–2 seconds.

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
