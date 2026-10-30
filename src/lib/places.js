import { getMapProvider } from './map-settings.js';
export const validLocation = location => location && Number.isFinite(location.lat) && Number.isFinite(location.lng) && Math.abs(location.lat) <= 90 && Math.abs(location.lng) <= 180;

const cache = new Map();
const searchURL = import.meta.env.VITE_MAP_SEARCH_URL || 'https://photon.komoot.io/api/';
const reverseURL = import.meta.env.VITE_MAP_REVERSE_URL || new URL('../reverse', searchURL).href;
const addresses = new Map();

export function formatPlaceAddress(info) {
  const street = [info.street, info.housenumber].filter(Boolean).join(', ');
  const city = info.city || info.town || info.village || info.locality;
  return [...new Set([street || info.name, city, info.country].filter(Boolean))].join(', ');
}

export async function reversePlace(point, signal, provider = getMapProvider()) {
  if (!validLocation(point)) throw new Error('Не удалось определить точку на карте.');
  signal.throwIfAborted();
  if (provider === 'apple') return (await import('./apple-maps.js')).reverseApplePlace(point, signal);
  const key = `${point.lat.toFixed(6)}:${point.lng.toFixed(6)}`;
  if (addresses.has(key)) return { ...point, ...addresses.get(key) };
  const url = new URL(reverseURL);
  url.searchParams.set('lat', String(point.lat)); url.searchParams.set('lon', String(point.lng));
  url.searchParams.set('limit', '3'); url.searchParams.set('radius', '0.1');
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error('Не удалось получить адрес. Можно сохранить метку с координатами или указать название вручную.');
  const body = await response.json(); signal.throwIfAborted();
  const properties = (body.features || []).map(feature => feature.properties || {});
  const info = properties.find(item => item.street && item.housenumber) || properties.find(item => item.street || item.name);
  if (!info) return null;
  const address = formatPlaceAddress(info);
  if (!address) return null;
  const namedPlace = info.name && info.name !== info.street && info.name !== info.housenumber ? info.name : '';
  const result = { label: namedPlace || [info.street, info.housenumber].filter(Boolean).join(', ') || address, address };
  if (addresses.size >= 100) addresses.delete(addresses.keys().next().value);
  addresses.set(key, result);
  // Keep the exact pin position; the service may return a nearby building centroid.
  return { ...point, ...result };
}

export async function searchPlaces(query, signal, provider = getMapProvider()) {
  if (provider === 'apple') return (await import('./apple-maps.js')).searchApplePlaces(query, signal);
  const key = query.trim();
  if (cache.has(key)) return cache.get(key);
  const url = new URL(searchURL);
  url.searchParams.set('q', key);
  url.searchParams.set('limit', '7');
  // Bias toward the app's default city without requesting the device location.
  url.searchParams.set('lat', '59.9343');
  url.searchParams.set('lon', '30.3351');
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error('Поиск временно недоступен. Попробуй ещё раз или выбери точку на карте.');
  const body = await response.json();
  const matches = (body.features || []).map(item => {
    const info = item.properties || {};
    const address = [info.street, info.housenumber, info.city || info.town || info.village, info.country].filter(Boolean).join(', ');
    return { lat: item.geometry?.coordinates?.[1], lng: item.geometry?.coordinates?.[0], label: info.name || address || 'Место', address };
  }).filter(validLocation);
  if (signal.aborted) throw new DOMException('Запрос отменён', 'AbortError');
  if (cache.size >= 50) cache.delete(cache.keys().next().value);
  cache.set(key, matches);
  return matches;
}

export async function resolvePlace(suggestion, signal) {
  if (validLocation(suggestion)) return suggestion;
  if (suggestion.provider === 'apple') return (await import('./apple-maps.js')).resolveApplePlace(suggestion, signal);
  throw new Error('Не удалось определить координаты места.');
}
