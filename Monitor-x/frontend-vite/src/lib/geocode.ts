/**
 * Robust address → lat/lng geocoding, anchored by PIN code.
 *
 * Failure modes this handles:
 *  - Nominatim exact search returns ZERO results for detailed Indian
 *    addresses ("#12, 3rd Cross, Some Apartment, Whitefield, 560066").
 *  - Photon's fuzzy matching (and simplified-address retries) can "succeed"
 *    on the WRONG place — e.g. an apartment with a similar name in another
 *    part of the city — which then snaps the employee to the wrong route.
 *
 * Strategy: if the address contains a 6-digit PIN code, geocode the PIN
 * first (structured search — very reliable) and use it as an ANCHOR. Every
 * candidate from the fuzzy/simplified attempts must lie within
 * MAX_ANCHOR_KM of the anchor or it is rejected. If nothing credible is
 * found, the PIN-area centroid itself is returned as an approximate
 * location. Without a PIN, the first hit wins (best effort).
 */

export interface GeoResult {
  lat: number;
  lng: number;
  /** Human-readable name of the place the geocoder actually matched. */
  label: string;
  /** True when we fell back to the PIN-code area centroid. */
  approximate?: boolean;
}

const MAX_ANCHOR_KM = 15; // PIN zones span a few km; cross-city errors are 20km+

function haversineKm(a: GeoResult | { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

async function tryNominatim(query: string): Promise<GeoResult | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    if (Array.isArray(data) && data.length > 0) {
      return {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon),
        label: (data[0].display_name as string | undefined)?.split(',').slice(0, 3).join(',') ?? query,
      };
    }
  } catch {
    // network error — caller moves on to the next strategy
  }
  return null;
}

/** Structured postal-code lookup — the most reliable signal in Indian addresses. */
async function tryPinCode(pin: string): Promise<GeoResult | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?postalcode=${pin}&country=india&format=json&limit=1`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    if (Array.isArray(data) && data.length > 0) {
      return {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon),
        label: (data[0].display_name as string | undefined)?.split(',').slice(0, 3).join(',') ?? `PIN ${pin}`,
      };
    }
  } catch {
    // ignore
  }
  return null;
}

async function tryPhoton(query: string): Promise<GeoResult | null> {
  try {
    const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=1`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const feat = data?.features?.[0];
    const coords: [number, number] | undefined = feat?.geometry?.coordinates;
    if (coords && coords.length === 2) {
      const p = feat.properties ?? {};
      const label = [p.name, p.district, p.city ?? p.county].filter(Boolean).join(', ') || query;
      return { lat: coords[1], lng: coords[0], label }; // GeoJSON is [lng, lat]
    }
  } catch {
    // ignore
  }
  return null;
}

/** Build progressively simpler variants of a messy address (most specific first). */
function addressVariants(address: string): string[] {
  const variants: string[] = [];
  const push = (v: string) => {
    const t = v.replace(/\s+/g, ' ').replace(/\s*,\s*/g, ', ').trim().replace(/^,|,$/g, '');
    if (t && t !== address.trim() && !variants.includes(t)) variants.push(t);
  };

  // Strip door/plot numbers and hash prefixes: "#12", "No. 4/2", "12-3-45"
  const noDoor = address
    .replace(/(^|,)\s*(#|no\.?|door\s*no\.?|flat\s*no\.?|plot\s*no\.?)\s*[\w/-]+/gi, '$1')
    .replace(/(^|,)\s*\d+[\w/-]*\s*(,|$)/g, '$1$2');
  push(noDoor);

  // Drop the most specific segment(s) from the front, keeping at least two
  const parts = address.split(',').map((s) => s.trim()).filter(Boolean);
  for (let start = 1; start <= parts.length - 2; start++) {
    push(parts.slice(start).join(', '));
  }

  return variants.slice(0, 5); // keep the request count polite
}

const GENERIC_TOKENS = /^(bangalore|bengaluru|karnataka|india|city)$/i;

/**
 * Guess the locality segment of an Indian address — the last comma segment
 * that is not the city/state/country and not a bare number/PIN. For
 * "Sri Nilaya, 2nd Main, KR Puram, Bangalore 560036" this returns "KR Puram".
 */
function guessLocality(address: string): string | null {
  const segs = address
    .split(',')
    .map((s) => s.replace(/\b[1-9]\d{5}\b/g, '').trim()) // strip PINs
    .filter(Boolean)
    .filter((s) => !GENERIC_TOKENS.test(s))
    .filter((s) => !/^\d[\w/-]*$/.test(s)); // bare numbers / door numbers
  return segs.length > 0 ? segs[segs.length - 1] : null;
}

/** Anchor from the locality name: "KR Puram" → geocode "KR Puram, Bengaluru, India". */
async function tryLocalityAnchor(locality: string): Promise<GeoResult | null> {
  const collapsed = locality.replace(/\b([A-Za-z])\s+(?=[A-Za-z]\b)/g, '$1'); // "K R Puram" → "KR Puram"
  const queries = [...new Set([`${locality}, Bengaluru, India`, `${collapsed}, Bengaluru, India`])];
  for (const q of queries) {
    const hit = (await tryNominatim(q)) ?? (await tryPhoton(q));
    if (hit) return hit;
  }
  return null;
}

/**
 * Geocode a free-text address, validated against an ANCHOR so a fuzzy match
 * in the wrong part of the city can never win:
 *   - PIN code in the address → PIN-area anchor (structured lookup), else
 *   - locality segment of the address ("KR Puram", "Whitefield", …) → anchor.
 * Candidates farther than MAX_ANCHOR_KM from the anchor are rejected; when
 * nothing credible is found the anchor itself is returned as approximate.
 * Returns null only when every strategy fails.
 * (Name kept for backward compatibility with existing callers.)
 */
export async function nominatimGeocode(address: string): Promise<GeoResult | null> {
  const full = address.trim();

  // 1. Build the anchor: PIN code first (most reliable), else locality name
  const pin = full.match(/\b[1-9]\d{5}\b/)?.[0] ?? null;
  let anchor = pin ? await tryPinCode(pin) : null;
  if (!anchor) {
    const locality = guessLocality(full);
    if (locality) anchor = await tryLocalityAnchor(locality);
  }
  const credible = (r: GeoResult | null): r is GeoResult =>
    r !== null && (!anchor || haversineKm(r, anchor) <= MAX_ANCHOR_KM);

  // 2. Full address: exact first, then fuzzy
  const exact = await tryNominatim(full);
  if (credible(exact)) return exact;
  const fuzzy = await tryPhoton(full);
  if (credible(fuzzy)) return fuzzy;

  // 3. Simplified variants, most → least specific
  for (const q of addressVariants(full)) {
    const hit = (await tryNominatim(q)) ?? (await tryPhoton(q));
    if (credible(hit)) return hit;
  }

  // 4. Nothing credible — the anchor (PIN/locality centre) is the right area
  if (anchor) return { ...anchor, approximate: true };

  // 5. No anchor to validate against: accept whatever the full address gave us
  return exact ?? fuzzy ?? null;
}
