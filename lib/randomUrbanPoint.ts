import citiesRaw from './data/cities50k.json'

// JSON is [[lat, lng], ...] — 12k cities with 50k+ population
const cityList = citiesRaw as [number, number][]

/** Returns a random city centre from cities with 50,000+ population. */
export function randomUrbanPoint(): { lng: number; lat: number } {
  const [lat, lng] = cityList[Math.floor(Math.random() * cityList.length)]
  return { lng, lat }
}
