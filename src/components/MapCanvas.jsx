import { lazy, Suspense } from 'preact/compat';
import { getMapProvider } from '../lib/map-settings.js';
export { validLocation } from '../lib/places.js';
const AppleMapCanvas = lazy(() => import('./AppleMapCanvas.jsx'));
const VectorMapCanvas = lazy(() => import('./VectorMapCanvas.jsx'));

export function MapCanvas({ provider = getMapProvider(), ...props }) {
  const Canvas = provider === 'apple' ? AppleMapCanvas : VectorMapCanvas;
  return <Suspense fallback={<div class="map-canvas-wrap"><span class="map-loading">Загружаю карту…</span></div>}><Canvas {...props}/></Suspense>;
}
export function MapSourceSwitch({ provider, onChange }) {
  return <div class="map-source-switch" role="group" aria-label="Источник карты">{[['maplibre', 'OpenFreeMap'], ['apple', 'Apple Maps']].map(([id, name]) => <button type="button" key={id} aria-pressed={provider === id} class={provider === id ? 'active' : ''} onClick={() => onChange(id)}>{name}</button>)}</div>;
}
