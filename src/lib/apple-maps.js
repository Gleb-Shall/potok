import { load } from '@apple/mapkit-loader';
import { appleMapsToken } from './map-settings.js';

let pending;
export function loadAppleMaps() {
  const token = appleMapsToken();
  if (!token) return Promise.reject(new Error('Для Apple Maps нужен Maps Token. Инструкция подключения находится в README проекта. Пока можно выбрать OpenFreeMap.'));
  if (!pending) {
    let timer;
    pending = Promise.race([
      load({ token, version: '6', language: 'ru-RU', libraries: ['map', 'services', 'annotations'] }),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Apple Maps не ответила. Проверь интернет, Maps Token и разрешённый домен.')), 15000); }),
    ]).catch(error => { pending = null; throw error; }).finally(() => clearTimeout(timer));
  }
  return pending;
}

export async function searchApplePlaces(query, signal) {
  const kit = await loadAppleMaps(); signal.throwIfAborted();
  const search = new kit.Search({ language: 'ru-RU', region: new kit.CoordinateRegion(new kit.Coordinate(59.9343, 30.3351), new kit.CoordinateSpan(.3, .3)) });
  const response = await search.autocomplete(query, { signal }); signal.throwIfAborted();
  return response.results.slice(0, 7).map((completion, index) => ({ id: `apple:${index}`, provider: 'apple', label: completion.displayLines[0] || query, address: completion.displayLines.slice(1).join(', '), completion }));
}

export async function resolveApplePlace(suggestion, signal) {
  const kit = await loadAppleMaps(); signal.throwIfAborted();
  const response = await new kit.Search({ language: 'ru-RU' }).search(suggestion.completion, { signal }); signal.throwIfAborted();
  const place = response.places[0];
  if (!place?.coordinate) throw new Error('Не удалось определить координаты места. Выбери другую подсказку или точку на карте.');
  return { lat: place.coordinate.latitude, lng: place.coordinate.longitude, label: place.name || suggestion.label, address: place.formattedAddress || suggestion.address };
}
