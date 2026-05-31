export type GameMode = 'urban' | 'uncharted' | 'terra'

export interface RoundResult {
  score:        number
  distanceKm:   number | null
  timeTakenSec: number
  didGuess:     boolean
}
