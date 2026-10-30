import { useEffect, useRef, useState } from 'preact/hooks';
import { Map as VectorMap, Marker, LngLatBounds, setWorkerUrl } from 'maplibre-gl';
import workerURL from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import 'maplibre-gl/dist/maplibre-gl.css';
import { validLocation } from '../lib/places.js';

export { validLocation } from '../lib/places.js';
setWorkerUrl(workerURL);
const styleURL = import.meta.env.VITE_MAP_STYLE_URL || 'https://tiles.openfreemap.org/styles/liberty';
const emptyPoints = [];

export function MapCanvas({ location, points = emptyPoints, onPick, onSelect }) {
  const element = useRef(null);
  const mapRef = useRef(null);
  const lastPicked = useRef(null);
  const cameraSignature = useRef('');
  const callbacks = useRef({ onPick, onSelect, location });
  callbacks.current = { onPick, onSelect, location };
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let map;
    try {
      map = new VectorMap({
        container: element.current, style: styleURL, center: [30.3351, 59.9343], zoom: 12,
        maxZoom: 20, scrollZoom: true, cooperativeGestures: false, dragRotate: false,
        touchPitch: false, attributionControl: { compact: true },
      });
    } catch {
      setLoading(false); setError('Не удалось запустить карту. Проверь, включено ли аппаратное ускорение в браузере.');
      return;
    }
    mapRef.current = map;
    map.on('load', () => { setLoading(false); setError(''); });
    map.on('error', () => { setLoading(false); setError('Не удалось загрузить часть карты. Проверь интернет и попробуй передвинуть карту.'); });
    map.on('idle', () => { if (map.isStyleLoaded()) setError(''); });
    map.on('click', event => {
      if (!callbacks.current.onPick) return;
      const point = { lat: event.lngLat.lat, lng: event.lngLat.lng, label: 'Выбранное место' };
      lastPicked.current = point;
      callbacks.current.onPick(point);
    });
    const observer = new ResizeObserver(() => map.resize()); observer.observe(element.current);
    return () => { observer.disconnect(); map.remove(); mapRef.current = null; };
  }, []);
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const list = validLocation(location) ? [{ ...location, id: 'selected', count: 1 }] : points.filter(validLocation);
    const markers = list.map(point => {
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'place-marker';
      button.setAttribute('aria-label', `${point.label || 'Место события'}${point.count > 1 ? ` · событий: ${point.count}` : ''}`);
      const circle = document.createElement('span'); const count = document.createElement('b');
      count.textContent = point.count > 1 ? String(point.count) : '●'; circle.append(count); button.append(circle);
      button.addEventListener('click', event => { event.stopPropagation(); callbacks.current.onSelect?.(point.id); });
      const marker = new Marker({ element: button, draggable: Boolean(callbacks.current.onPick), anchor: 'bottom' }).setLngLat([point.lng, point.lat]).addTo(map);
      marker.on('dragend', () => {
        const position = marker.getLngLat();
        const selected = { lat: position.lat, lng: position.lng, label: callbacks.current.location?.label || 'Выбранное место' };
        lastPicked.current = selected; callbacks.current.onPick?.(selected);
      });
      return marker;
    });
    const justPicked = location && lastPicked.current?.lat === location.lat && lastPicked.current?.lng === location.lng;
    const signature = list.map(point => `${point.id}:${point.lat}:${point.lng}`).join('|');
    const geometryChanged = cameraSignature.current !== signature;
    cameraSignature.current = signature;
    if (geometryChanged && list.length === 1 && !justPicked) map.easeTo({ center: [list[0].lng, list[0].lat], zoom: 16, duration: 500, padding: { top: 0, bottom: 0, left: 0, right: 0 } });
    else if (geometryChanged && list.length > 1) {
      const bounds = new LngLatBounds(); list.forEach(point => bounds.extend([point.lng, point.lat]));
      map.fitBounds(bounds, { padding: { top: 50, bottom: 50, left: 50, right: element.current.clientWidth > 700 ? 370 : 50 }, maxZoom: 16, duration: 500 });
    }
    return () => markers.forEach(marker => marker.remove());
  }, [location, points]);
  return <div class="map-canvas-wrap"><div ref={element} class="map-canvas" aria-label="Карта мест событий"/>{loading && <span class="map-loading" role="status">Загружаю карту…</span>}{error && <p class="map-error" role="status">{error}</p>}</div>;
}
