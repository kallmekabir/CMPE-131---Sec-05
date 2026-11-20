// Turns an event's text location into map coordinates with OpenStreetMap's Nominatim (free, no key).
// Nominatim asks for at most 1 request/second, so lookups run one at a time and results are cached in localStorage.

export const CAMPUS_CENTER = [37.3352, -121.8811]; // SJSU
const VIEWBOX = '-121.92,37.36,-121.84,37.30'; // left,top,right,bottom around downtown San Jose
const CACHE_KEY = 'spartin.geocache.v1';
const DELAY_MS = 1100;

function readCache() {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY)) || {};
  } catch {
    return {};
  }
}
function writeCache(cache) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    /* storage blocked — just geocode again next time */
  }
}

async function lookup(query) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&viewbox=${VIEWBOX}&bounded=1&q=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error('geocoder unavailable');
  const [hit] = await res.json();
  return hit ? [Number(hit.lat), Number(hit.lon)] : null;
}

/** → { coords: [lat, lng], approximate: boolean } — never throws; falls back to the campus center. */
export async function geocodeLocation(location) {
  const key = location.trim().toLowerCase();
  const cache = readCache();
  if (cache[key]) return cache[key];
  let result = { coords: CAMPUS_CENTER, approximate: true };
  let cacheable = true;
  try {
    const coords = (await lookup(`${location}, San Jose, CA`)) || (await lookup(`${location}, San Jose State University`));
    if (coords) result = { coords, approximate: false };
  } catch {
    cacheable = false; // network/rate-limit problem: try again next visit instead of remembering the fallback
  }
  if (cacheable) {
    cache[key] = result;
    writeCache(cache);
  }
  return result;
}

/** Geocodes many locations sequentially, calling onResult(location, result) as each one finishes. */
export async function geocodeAll(locations, onResult, isCancelled = () => false) {
  const cache = readCache();
  for (const location of [...new Set(locations)]) {
    if (isCancelled()) return;
    const cached = cache[location.trim().toLowerCase()];
    if (!cached) await new Promise((r) => setTimeout(r, DELAY_MS));
    if (isCancelled()) return;
    onResult(location, cached || (await geocodeLocation(location)));
  }
}
