// One-time HD tile capture for the menu.
// Most tiles come from the Mapbox Static Images API (reads
// NEXT_PUBLIC_MAPBOX_TOKEN from .env.local, never printed; token is
// URL-restricted so we present a localhost Referer). Terra uses the
// public-domain Apollo 17 "Blue Marble" — a true whole-Earth photo.
// All stills are optimised to web JPEGs with sharp.
//
//   node scripts/capture-tiles.mjs

import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import sharp from 'sharp'

const root  = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const env   = await readFile(path.join(root, '.env.local'), 'utf8')
const token = env.match(/NEXT_PUBLIC_MAPBOX_TOKEN\s*=\s*(\S+)/)?.[1]?.trim()
if (!token) { console.error('NEXT_PUBLIC_MAPBOX_TOKEN not found in .env.local'); process.exit(1) }

// type 'mb'  → Mapbox satellite static at [lon, lat, zoom]
// type 'url' → fetch an external image directly (fit: contain on space-black)
const SHOTS = {
  terra:     { type: 'url', src: 'https://upload.wikimedia.org/wikipedia/commons/9/97/The_Earth_seen_from_Apollo_17.jpg', fit: 'contain' },
  urban:     { type: 'mb', lon: -73.969,  lat:  40.782, zoom: 12.4 },  // Manhattan
  usa:       { type: 'mb', lon: -97.0,    lat:  39.2,   zoom:  4.4 },  // contiguous US, coast to coast
  europe:    { type: 'mb', lon:  10.0,    lat:  50.0,   zoom:  4.3 },  // all of Europe
  mountains: { type: 'mb', lon:   6.90,   lat:  45.87,  zoom: 10.5 },  // Mont Blanc massif, the Alps
  volcanoes: { type: 'mb', lon: 138.731,  lat:  35.361, zoom: 11.8 },  // Mount Fuji
  islands:   { type: 'mb', lon: -151.741, lat: -16.501, zoom: 12.7 },  // Bora Bora
  uncharted: { type: 'mb', lon: -59.83,   lat:  -3.34,  zoom: 10.5 },  // Amazon — Meeting of Waters (river-centred)
  airports:  { type: 'mb', lon: -71.018,  lat:  42.366, zoom: 13.2 },  // Boston Logan (home city)
  landmarks: { type: 'mb', lon:  31.131,  lat:  29.977, zoom: 14.6 },  // Giza pyramids
}

await mkdir(path.join(root, 'public', 'images'), { recursive: true })

for (const [key, s] of Object.entries(SHOTS)) {
  let res
  if (s.type === 'url') {
    res = await fetch(s.src, { headers: { 'User-Agent': 'StrataTileCapture/1.0 (novaknic17@gmail.com)' } })
  } else {
    const url =
      `https://api.mapbox.com/styles/v1/mapbox/satellite-v9/static/` +
      `${s.lon},${s.lat},${s.zoom},0/1280x1280@2x` +
      `?access_token=${token}&attribution=false&logo=false`
    res = await fetch(url, { headers: { Referer: 'http://localhost:3000/' } })
  }
  if (!res.ok) { console.error(key, res.status, (await res.text()).slice(0, 120)); continue }

  const src = Buffer.from(await res.arrayBuffer())
  const jpg = await sharp(src)
    .resize(1600, 1600, { fit: s.fit ?? 'cover', background: { r: 6, g: 8, b: 16 } })
    .jpeg({ quality: 82 })
    .toBuffer()
  await writeFile(path.join(root, 'public', 'images', `${key}.jpg`), jpg)
  console.log(`${key.padEnd(10)} ${(jpg.length / 1024).toFixed(0)} KB`)
}

// Flat square web-mercator world for the interactive menu map.
// center 0,0 zoom 2 at 1024 logical px = exactly one world (256·2² = 1024),
// so pins project with the standard web-mercator formula.
{
  const url =
    `https://api.mapbox.com/styles/v1/mapbox/satellite-v9/static/0,0,2/1024x1024@2x` +
    `?access_token=${token}&attribution=false&logo=false`
  const res = await fetch(url, { headers: { Referer: 'http://localhost:3000/' } })
  if (!res.ok) { console.error('world', res.status, (await res.text()).slice(0, 120)) }
  else {
    const jpg = await sharp(Buffer.from(await res.arrayBuffer())).jpeg({ quality: 80 }).toBuffer()
    await writeFile(path.join(root, 'public', 'images', 'world.jpg'), jpg)
    console.log(`world      ${(jpg.length / 1024).toFixed(0)} KB`)
  }
}

console.log('done')
