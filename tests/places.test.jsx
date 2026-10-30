import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { formatPlaceAddress, reversePlace } from '../src/lib/places.js';

beforeEach(() => { localStorage.clear(); vi.stubGlobal('fetch', vi.fn()); });
afterEach(() => vi.unstubAllGlobals());
const point = (lat = 59.94) => ({ lat, lng: 30.3, label: 'Выбранное место' });
const response = properties => ({ ok: true, json: async () => ({ features: [{ properties, geometry: { coordinates: [30.4, 60] } }] }) });

it('formats a readable address without duplicated locality names', () => {
  expect(formatPlaceAddress({ street: 'Университетская набережная', housenumber: '7–9', city: 'Санкт-Петербург', country: 'Россия' })).toBe('Университетская набережная, 7–9, Санкт-Петербург, Россия');
  expect(formatPlaceAddress({ name: 'Санкт-Петербург', city: 'Санкт-Петербург' })).toBe('Санкт-Петербург');
});
it('looks up an address and keeps the exact clicked coordinates rather than the result centroid', async () => {
  fetch.mockResolvedValue(response({ name: 'Главный корпус', street: 'Университетская набережная', housenumber: '7–9', city: 'Санкт-Петербург' }));
  const result = await reversePlace(point(), new AbortController().signal, 'maplibre');
  expect(result).toEqual({ ...point(), label: 'Главный корпус', address: 'Университетская набережная, 7–9, Санкт-Петербург' });
  const url = new URL(fetch.mock.calls[0][0]);
  expect(url.pathname).toBe('/reverse'); expect(url.searchParams.get('lat')).toBe('59.94');
});
it('reuses a previous address lookup for the same point', async () => {
  fetch.mockResolvedValue(response({ street: 'Невский проспект', housenumber: '1', city: 'Санкт-Петербург' }));
  await reversePlace(point(59.941), new AbortController().signal, 'maplibre');
  const repeated = await reversePlace(point(59.941), new AbortController().signal, 'maplibre');
  expect(fetch).toHaveBeenCalledOnce(); expect(repeated.address).toContain('Невский проспект, 1');
});
it('reports a missing address without inventing one', async () => {
  fetch.mockResolvedValue({ ok: true, json: async () => ({ features: [] }) });
  expect(await reversePlace(point(59.942), new AbortController().signal, 'maplibre')).toBeNull();
});
it('rejects failed or cancelled requests and invalid coordinates', async () => {
  fetch.mockResolvedValue({ ok: false });
  await expect(reversePlace(point(59.943), new AbortController().signal, 'maplibre')).rejects.toThrow('координатами');
  const controller = new AbortController(); controller.abort();
  await expect(reversePlace(point(59.944), controller.signal, 'maplibre')).rejects.toHaveProperty('name', 'AbortError');
  await expect(reversePlace(point(95), new AbortController().signal, 'maplibre')).rejects.toThrow('точку');
});
