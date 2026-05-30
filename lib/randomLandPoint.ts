/**
 * Picks a random point on land, biased toward interesting latitudes.
 *
 * Strategy:
 *  1. Generate a random lng/lat inside the bounding box [-180,-55,180,70].
 *  2. Reject ocean points using @turf/boolean-point-in-polygon against the
 *     Natural Earth 1:110m land MultiPolygon from world-atlas.
 *  3. Retry until a land point is found (typically 3–5 attempts).
 *
 * world-atlas note: objects.land is a GeometryCollection wrapping a single
 * MultiPolygon, so topojson.feature() returns a FeatureCollection<MultiPolygon>
 * with one element — we extract [0] to get the Feature booleanPointInPolygon needs.
 */

import worldDataJson from 'world-atlas/countries-110m.json'
import { feature as topoFeature } from 'topojson-client'
import type { Topology } from 'topojson-specification'
import { randomPoint } from '@turf/random'
import booleanPointInPolygon from '@turf/boolean-point-in-polygon'
import type { Feature, FeatureCollection, MultiPolygon } from 'geojson'

const topology = worldDataJson as unknown as Topology

// GeometryCollection → FeatureCollection; grab the one land MultiPolygon inside.
const landCollection = topoFeature(
  topology,
  topology.objects['land'],
) as FeatureCollection<MultiPolygon>

const land: Feature<MultiPolygon> = landCollection.features[0]

/** Longitude/latitude bounding box: exclude polar ice and southern ocean */
const BBOX: [number, number, number, number] = [-180, -55, 180, 70]

/** Returns a random {lng, lat} guaranteed to be on land. */
export function randomLandPoint(): { lng: number; lat: number } {
  for (;;) {
    const pt = randomPoint(1, { bbox: BBOX }).features[0]
    if (booleanPointInPolygon(pt, land)) {
      const [lng, lat] = pt.geometry.coordinates
      return { lng, lat }
    }
  }
}
