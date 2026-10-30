import { useEffect, useState } from 'preact/hooks';

const key = 'tutor-schedule:map-provider';
export const appleMapsToken = () => import.meta.env.VITE_APPLE_MAPS_TOKEN?.trim() || '';
export function getMapProvider() {
  const saved = localStorage.getItem(key);
  if (['apple', 'maplibre'].includes(saved)) return saved;
  const configured = import.meta.env.VITE_MAP_PROVIDER;
  return ['apple', 'maplibre'].includes(configured) ? configured : appleMapsToken() ? 'apple' : 'maplibre';
}
export function useMapProvider() {
  const [provider, setProvider] = useState(getMapProvider);
  useEffect(() => {
    const sync = () => setProvider(getMapProvider());
    window.addEventListener('map-provider-change', sync); window.addEventListener('storage', sync);
    return () => { window.removeEventListener('map-provider-change', sync); window.removeEventListener('storage', sync); };
  }, []);
  return [provider, next => {
    if (!['apple', 'maplibre'].includes(next)) return;
    localStorage.setItem(key, next); setProvider(next); window.dispatchEvent(new Event('map-provider-change'));
  }];
}
