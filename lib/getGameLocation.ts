import type { GameMode, GameLocation } from './types'
import { randomLandPoint }              from './randomLandPoint'
import { randomUnchartedPoint }         from './randomUnchartedPoint'
import citiesRaw                        from './data/cities50k.json'
import islandsRaw                       from './data/islands.json'
import mountainsRaw                     from './data/mountains.json'
import volcanosRaw                      from './data/volcanoes.json'
import usaRaw                           from './data/usa.json'
import europeRaw                        from './data/europe.json'
import airportsRaw                      from './data/airports.json'
import landmarksRaw                     from './data/landmarks.json'

// cities: [name, lat, lng, country_code]
const urbanList     = citiesRaw    as [string, number, number, string][]
const islandsList   = islandsRaw   as [string, number, number, string][]
const usaList       = usaRaw       as [string, number, number, string][]
const europeList    = europeRaw    as [string, number, number, string][]
// anonymous coords only — names need allCountries (not downloaded)
const mountainsList = mountainsRaw as [number, number][]
const volcanosList  = volcanosRaw  as [number, number][]
// airports: [name, lat, lng, country_code, municipality]
const airportsList  = airportsRaw  as [string, number, number, string, string][]
// landmarks: [name, lat, lng]
const landmarksList = landmarksRaw as [string, number, number][]

/** Pick a city entry that carries its own name — skips reverse-geocoding. */
function pickCity(list: [string, number, number, string][]): GameLocation {
  const entry = list[Math.floor(Math.random() * list.length)]
  return { name: entry[0], lat: entry[1], lng: entry[2], country: entry[3] }
}

/** Pick a named entry of the form [name, lat, lng]. */
function pickNamed(list: [string, number, number][]): GameLocation {
  const entry = list[Math.floor(Math.random() * list.length)]
  return { name: entry[0], lat: entry[1], lng: entry[2] }
}

/** Pick a named airport entry [name, lat, lng, country, municipality]. */
function pickAirport(): GameLocation {
  const entry = airportsList[Math.floor(Math.random() * airportsList.length)]
  return { name: entry[0], lat: entry[1], lng: entry[2], country: entry[3] }
}

/** Pick anonymous [lat, lng] coords with an optional static label. */
function pickCoords(list: [number, number][], name?: string): GameLocation {
  const [lat, lng] = list[Math.floor(Math.random() * list.length)]
  return name ? { lat, lng, name } : { lat, lng }
}

export function getGameLocation(mode: GameMode): GameLocation {
  switch (mode) {
    // ── Reverse-geocoded (Terra & Uncharted have no name in data) ────────
    case 'terra':     return randomLandPoint()
    case 'uncharted': return randomUnchartedPoint()
    // ── Named cities (name + country_code in JSON) ────────────────────────
    case 'urban':     return pickCity(urbanList)
    case 'islands':   return pickCity(islandsList)
    case 'usa':       return pickCity(usaList)
    case 'europe':    return pickCity(europeList)
    // ── Static label (names need allCountries, not downloaded) ────────────
    case 'mountains': return pickCoords(mountainsList, 'Mountain Peak')
    case 'volcanoes': return pickCoords(volcanosList,  'Volcanic Peak')
    // ── Full name embedded in dataset ─────────────────────────────────────
    case 'airports':  return pickAirport()
    case 'landmarks': return pickNamed(landmarksList)
  }
}
