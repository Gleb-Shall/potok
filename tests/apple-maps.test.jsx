import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { render } from 'preact';
import { act } from 'preact/test-utils';
import AppleMapCanvas from '../src/components/AppleMapCanvas.jsx';
import MapPicker from '../src/components/MapPicker.jsx';
import { searchApplePlaces, resolveApplePlace, loadAppleMaps } from '../src/lib/apple-maps.js';

const sdk = vi.hoisted(() => ({ maps: [], load: vi.fn(), autocomplete: vi.fn(), search: vi.fn() }));
vi.mock('@apple/mapkit-loader', () => ({ load: sdk.load }));
const kit = {
  addEventListener: vi.fn(), removeEventListener: vi.fn(),
  Coordinate: class { constructor(latitude, longitude) { this.latitude = latitude; this.longitude = longitude; } },
  CoordinateRegion: class {}, CoordinateSpan: class {}, Padding: class {},
  MarkerAnnotation: class { constructor(coordinate, options) { this.coordinate = coordinate; Object.assign(this, options); } },
  Search: class { autocomplete(...args) { return sdk.autocomplete(...args); } search(...args) { return sdk.search(...args); } },
  Map: class {
    constructor(element, options) { this.element = element; this.options = options; this.cameraDistance = options.cameraDistance; this.listeners = new Map(); this.annotations = []; sdk.maps.push(this); }
    addEventListener(name, handler) { this.listeners.set(name, handler); }
    fire(name, event) { this.listeners.get(name)?.(event); }
    convertPointOnPageToCoordinate() { return new kit.Coordinate(59.94, 30.3); }
    addAnnotations(items) { this.annotations.push(...items); }
    removeAnnotations(items) { this.annotations = this.annotations.filter(item => !items.includes(item)); }
    setCenterAnimated() {} setCameraDistanceAnimated() {} showItems() {} destroy() {}
  },
};
let root;
beforeEach(() => {
  root = document.createElement('div'); document.body.append(root); localStorage.clear(); sdk.maps.length = 0;
  sdk.load.mockClear().mockResolvedValue(kit);
  sdk.autocomplete.mockReset().mockResolvedValue({ results: [{ displayLines: ['Учебный корпус', 'Санкт-Петербург'] }] });
  sdk.search.mockReset().mockResolvedValue({ places: [{ name: 'Учебный корпус', formattedAddress: 'Санкт-Петербург', coordinate: { latitude: 59.94, longitude: 30.3 } }] });
  vi.stubEnv('VITE_APPLE_MAPS_TOKEN', 'test-domain-restricted-browser-token');
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; };
});
afterEach(async () => { await act(() => render(null, root)); root.remove(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
const mount = async component => { await act(async () => render(component, root)); };

it('requires a Maps Token and does not attempt an unauthenticated SDK request', async () => {
  vi.stubEnv('VITE_APPLE_MAPS_TOKEN', '');
  await expect(loadAppleMaps()).rejects.toThrow('Maps Token');
  await mount(<AppleMapCanvas/>);
  await vi.waitFor(() => expect(root.querySelector('[role=alert]')?.textContent).toContain('Maps Token'));
  expect(sdk.load).not.toHaveBeenCalled();
});
it('enables gestures, zooms by wheel without Ctrl and returns map coordinates', async () => {
  const onPick = vi.fn(); await mount(<AppleMapCanvas onPick={onPick}/>);
  await vi.waitFor(() => expect(sdk.maps).toHaveLength(1));
  const map = sdk.maps[0]; expect(map.options.isZoomEnabled).toBe(true); expect(map.options.showsZoomControl).toBe(false);
  const wheel = new WheelEvent('wheel', { deltaY: -100, bubbles: true, cancelable: true });
  root.querySelector('.apple-map').dispatchEvent(wheel);
  expect(wheel.defaultPrevented).toBe(true); expect(map.cameraDistance).toBeLessThan(18000);
  await act(() => map.fire('single-tap', { pointOnPage: { x: 100, y: 100 } }));
  expect(onPick).toHaveBeenCalledWith({ lat: 59.94, lng: 30.3, label: 'Выбранное место' });
});
it('resolves Apple suggestions to ordinary coordinates and honors request cancellation', async () => {
  const controller = new AbortController();
  const suggestions = await searchApplePlaces('Учебный', controller.signal);
  expect(suggestions[0].label).toBe('Учебный корпус');
  expect(sdk.autocomplete).toHaveBeenCalledWith('Учебный', { signal: controller.signal });
  const place = await resolveApplePlace(suggestions[0], controller.signal);
  expect(place).toEqual({ lat: 59.94, lng: 30.3, label: 'Учебный корпус', address: 'Санкт-Петербург' });
  expect(place).not.toHaveProperty('completion');
  controller.abort(); await expect(searchApplePlaces('Отмена', controller.signal)).rejects.toHaveProperty('name', 'AbortError');
});
it('selects Apple autocomplete in the same event place picker', async () => {
  const onChange = vi.fn(); await mount(<MapPicker value={null} saved={[]} onChange={onChange} onClose={() => {}}/>);
  const input = root.querySelector('[role=combobox]');
  await act(() => { input.value = 'Учебный корпус'; input.dispatchEvent(new Event('input', { bubbles: true })); });
  await vi.waitFor(() => expect(root.querySelector('[role=option]')).toBeTruthy());
  await act(async () => root.querySelector('[role=option]').click());
  await vi.waitFor(() => expect(root.querySelector('.place-floating-label')?.textContent).toContain('Учебный корпус'));
  const confirm = [...root.querySelectorAll('button')].find(button => button.textContent === 'Выбрать место');
  await act(() => confirm.click());
  expect(onChange).toHaveBeenCalledWith({ lat: 59.94, lng: 30.3, label: 'Учебный корпус', address: 'Санкт-Петербург' });
});
