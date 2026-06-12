export type GameMode =
  | 'urban' | 'uncharted' | 'terra'
  | 'islands' | 'mountains' | 'volcanoes' | 'usa' | 'europe'
  | 'airports' | 'landmarks'

/** Location returned by getGameLocation. name/country skip reverse-geocoding. */
export interface GameLocation {
  lng:      number
  lat:      number
  /** Present for modes with named targets (airports, landmarks). Skips reverse-geocoding. */
  name?:    string
  /** ISO country code, e.g. "US". Present alongside name when available. */
  country?: string
}

export interface RoundResult {
  score:        number
  distanceKm:   number | null
  timeTakenSec: number
  didGuess:     boolean
}
