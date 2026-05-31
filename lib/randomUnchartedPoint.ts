import { randomLandPoint } from './randomLandPoint'
import { haversineKm }     from './haversine'
import citiesRaw           from './data/cities50k.json'

// JSON is [[lat, lng], ...] — same dataset used by Urban mode
const cityList = citiesRaw as [number, number][]

// ~0.45° of latitude per 50km; 0.5° is a safe upper bound for a fast pre-check
const LAT_THRESHOLD = 0.5

function isFarFromCities(lng: number, lat: number): boolean {
  for (const [clat, clng] of cityList) {
    if (Math.abs(lat - clat) > LAT_THRESHOLD) continue   // cheap reject
    if (haversineKm([lng, lat], [clng, clat]) < 50) return false
  }
  return true
}

/** Returns a random land point at least 50 km from any city with 50k+ population. */
export function randomUnchartedPoint(): { lng: number; lat: number } {
  for (;;) {
    const pt = randomLandPoint()
    if (isFarFromCities(pt.lng, pt.lat)) return pt
  }
}
