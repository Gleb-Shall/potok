import { getMapProvider } from './map-settings.js';
export const validLocation = location => location && Number.isFinite(location.lat) && Number.isFinite(location.lng) && Math.abs(location.lat) <= 90 && Math.abs(location.lng) <= 180;

const cache = new Map();
const searchURL = import.meta.env.VITE_MAP_SEARCH_URL || 'https://photon.komoot.io/api/';

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
