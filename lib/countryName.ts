// ISO-3166 alpha-2 → display country name.
//
// Uses the browser/Node-native Intl.DisplayNames for accurate names across
// every country, with a small override map for names that are too long
// (abbreviate) or that CLDR spells oddly for a game UI.

const OVERRIDES: Record<string, string> = {
  US: 'USA',          // United States
  GB: 'UK',           // United Kingdom
  AE: 'UAE',          // United Arab Emirates
  CD: 'DR Congo',     // CLDR: "Congo - Kinshasa"
  CG: 'Congo',        // CLDR: "Congo - Brazzaville"
  MM: 'Myanmar',      // CLDR: "Myanmar (Burma)"
}

let dn: Intl.DisplayNames | null | undefined
function regionNames(): Intl.DisplayNames | null {
  if (dn !== undefined) return dn
  try { dn = new Intl.DisplayNames(['en'], { type: 'region' }) }
  catch { dn = null }
  return dn
}

/** Full country name for an ISO-2 code (e.g. "CN" → "China"). */
export function countryName(cc?: string | null): string {
  if (!cc) return ''
  const code = cc.toUpperCase()
  if (OVERRIDES[code]) return OVERRIDES[code]
  const name = regionNames()?.of(code)
  return name && name !== code ? name : code   // fall back to the code if unknown
}
