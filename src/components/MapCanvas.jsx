import { useEffect, useRef, useState } from 'preact/hooks';
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export const validLocation = location => location && Number.isFinite(location.lat) && Number.isFinite(location.lng) && Math.abs(location.lat) <= 90 && Math.abs(location.lng) <= 180;
const tileURL = import.meta.env.VITE_MAP_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const emptyPoints = [];

export function MapCanvas({ location, points = emptyPoints, onPick, onSelect }) {
  const element = useRef(null);
  const mapRef = useRef(null);
  const callbacks = useRef({ onPick, onSelect });
  callbacks.current = { onPick, onSelect };
  const [error, setError] = useState('');
  useEffect(() => {
    const map = L.map(element.current, { scrollWheelZoom: false }).setView([59.9343, 30.3351], 12);
    mapRef.current = map;
    const tiles = L.tileLayer(tileURL, { maxZoom: 19, attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors' }).addTo(map);
    tiles.on('tileerror', () => setError('Часть карты не загрузилась. Проверь интернет или попробуй изменить масштаб.'));
    map.on('click', event => callbacks.current.onPick?.({ lat: event.latlng.lat, lng: event.latlng.lng, label: 'Выбранное место' }));
    const observer = new ResizeObserver(() => map.invalidateSize()); observer.observe(element.current);
    return () => { observer.disconnect(); map.remove(); mapRef.current = null; };
  }, []);
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const layer = L.layerGroup().addTo(map);
    const list = validLocation(location) ? [{ ...location, id: 'selected', count: 1 }] : points.filter(validLocation);
    for (const point of list) {
      const marker = L.marker([point.lat, point.lng], { draggable: Boolean(onPick), title: point.label || 'Место события', keyboard: true,
        icon: L.divIcon({ className: 'place-marker', html: `<span><b>${point.count > 1 ? Number(point.count) : '●'}</b></span>`, iconSize: [38, 48], iconAnchor: [19, 45] }) }).addTo(layer);
      marker.on('click', () => callbacks.current.onSelect?.(point.id));
      marker.on('dragend', () => { const position = marker.getLatLng(); callbacks.current.onPick?.({ lat: position.lat, lng: position.lng, label: 'Выбранное место' }); });
    }
    if (list.length === 1) map.setView([list[0].lat, list[0].lng], 16);
    else if (list.length > 1) map.fitBounds(L.latLngBounds(list.map(point => [point.lat, point.lng])), { paddingTopLeft: [45, 45], paddingBottomRight: [map.getSize().x > 700 ? 350 : 45, 45], maxZoom: 16 });
    return () => { map.removeLayer(layer); };
  }, [location?.lat, location?.lng, points]);
  return <div class="map-canvas-wrap"><div ref={element} class="map-canvas" aria-label="Карта мест событий"/>{error && <p class="map-error" role="status">{error}</p>}</div>;
}
