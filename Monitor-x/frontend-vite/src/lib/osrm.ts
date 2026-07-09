export type LatLng = [number, number];

const cache = new Map<string, LatLng[]>();

/**
 * Fetch a driving path between two points from the public OSRM demo server.
 * Returns Leaflet-ordered [lat, lng] coordinates. Falls back to a straight
 * line [from, to] on any failure so the map always renders.
 */
export async function fetchRoadPath(from: LatLng, to: LatLng): Promise<LatLng[]> {
  const key = `${from[0]},${from[1]};${to[0]},${to[1]}`;
  const cached = cache.get(key);
  if (cached) return cached;

  try {
    const url =
      `https://router.project-osrm.org/route/v1/driving/` +
      `${from[1]},${from[0]};${to[1]},${to[0]}?overview=full&geometries=geojson`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`OSRM ${res.status}`);
    const data = await res.json();
    const coords: [number, number][] | undefined = data?.routes?.[0]?.geometry?.coordinates;
    if (!coords || coords.length < 2) throw new Error("No route geometry");
    const path: LatLng[] = coords.map(([lng, lat]) => [lat, lng]);
    cache.set(key, path);
    return path;
  } catch {
    return [from, to];
  }
}
