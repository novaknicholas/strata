import type { GameMode }          from './types'
import { randomLandPoint }         from './randomLandPoint'
import { randomUrbanPoint }        from './randomUrbanPoint'
import { randomUnchartedPoint }    from './randomUnchartedPoint'

export function getGameLocation(mode: GameMode): { lng: number; lat: number } {
  switch (mode) {
    case 'urban':     return randomUrbanPoint()
    case 'uncharted': return randomUnchartedPoint()
    case 'terra':     return randomLandPoint()
  }
}
