/** Great-circle distance in kilometres between two [lng, lat] pairs. */
export function haversineKm(
  [lng1, lat1]: [number, number],
  [lng2, lat2]: [number, number],
): number {
  const R  = 6_371
  const φ1 = (lat1 * Math.PI) / 180
  const φ2 = (lat2 * Math.PI) / 180
  const Δφ = ((lat2 - lat1) * Math.PI) / 180
  const Δλ = ((lng2 - lng1) * Math.PI) / 180
  const a  =
    Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/**
 * Score out of 6 000.
 *
 * accuracy   (0–3 000):  sqrt-based exponential decay with divisor 20
 *   city block (0.1 km) ≈ 2 953   neighbourhood (1 km) ≈ 2 853
 *   city       (5 km)   ≈ 2 681   region        (50 km) ≈ 2 105
 *   country    (200 km) ≈ 1 479   large country (500 km) ≈  980
 *   continent  (1 000 km) ≈  617  far           (3 000 km) ≈  195
 *
 * multiplier (1.0–2.0):  linear — fast guess doubles the accuracy score.
 *   instant (0 s elapsed) → ×2.0     full time (20 s elapsed) → ×1.0
 *
 * A random instant guess at 3 000 km scores ≈ 195 × 2 = 390 (in the hundreds).
 * A perfect instant guess scores 3 000 × 2.0 = 6 000.
 */
export function calcScore(
  distanceKm:   number,
  timeTakenSec: number,
  gameDuration: number,
): number {
  const accuracy   = 3_000 * Math.exp(-Math.sqrt(distanceKm) / 20)
  const multiplier = 1 + (1 - timeTakenSec / gameDuration)   // [2.0 instant → 1.0 slow]
  return Math.min(6_000, Math.round(accuracy * multiplier))
}

/**
 * Mapbox zoom level that frames a guess–target distance on the main satellite map.
 * Stepped so each bracket shows a clean amount of geographic context.
 */
export function zoomForDistance(distanceKm: number): number {
  if (distanceKm <    5) return 11   // neighbourhood
  if (distanceKm <   50) return  9   // city / region
  if (distanceKm <  500) return  7   // country
  if (distanceKm < 2_000) return 5   // continental
  return 3                            // global
}
