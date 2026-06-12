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
 * accuracy   (0–3 000):  sqrt-based exponential decay with divisor 30
 *   city block (0.1 km) ≈ 2 973   neighbourhood (1 km) ≈ 2 914
 *   city       (5 km)   ≈ 2 785   region        (50 km) ≈ 2 370
 *   country    (200 km) ≈ 1 872   large country (500 km) ≈ 1 424
 *   continent  (1 000 km) ≈  1056  far           (3 000 km) ≈  483
 *
 * multiplier (1.0–2.0):  linear — fast guess doubles the accuracy score.
 *   instant (0 s elapsed) → ×2.0     full time elapsed → ×1.0
 *
 * A random instant guess at 3 000 km scores ≈ 483 × 2 = 966.
 * A perfect instant guess scores 3 000 × 2.0 = 6 000.
 */
export function calcScore(
  distanceKm:   number,
  timeTakenSec: number,
  gameDuration: number,
): number {
  const accuracy   = 3_000 * Math.exp(-Math.sqrt(distanceKm) / 30)
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
