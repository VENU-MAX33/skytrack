/** Geocode a free-text address via Nominatim (OpenStreetMap). */
export async function nominatimGeocode(
  address: string
): Promise<{ lat: number; lng: number } | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`;
    const res = await fetch(url, { headers: { "User-Agent": "MonitorX-TMS/1.0" } });
    const data = await res.json();
    if (data.length > 0) return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch {
    // ignore — caller shows a toast and lets the admin enter lat/lng manually
  }
  return null;
}
