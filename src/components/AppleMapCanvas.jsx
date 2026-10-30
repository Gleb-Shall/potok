import { useEffect, useRef, useState } from 'preact/hooks';
import { loadAppleMaps } from '../lib/apple-maps.js';
import { validLocation } from '../lib/places.js';

const emptyPoints = [];
export default function AppleMapCanvas({ location, points = emptyPoints, onPick, onSelect }) {
  const element = useRef(null);
  const instance = useRef(null);
  const callbacks = useRef({ location, onPick, onSelect }); callbacks.current = { location, onPick, onSelect };
  const lastPicked = useRef(null);
  const signature = useRef('');
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true, map, kit, observer, wheel;
    const fail = () => { if (active) setError('Apple Maps отклонила запрос. Проверь Maps Token и доступ для текущего домена.'); };
    loadAppleMaps().then(loaded => {
      if (!active) return;
      kit = loaded; kit.addEventListener('error', fail);
      map = new kit.Map(element.current, { center: new kit.Coordinate(59.9343, 30.3351), cameraDistance: 18000, isScrollEnabled: true, isZoomEnabled: true, isRotationEnabled: false, showsZoomControl: false, showsMapTypeControl: false, showsUserLocationControl: false, tintColor: '#8076cc' });
      instance.current = { map, kit };
      // Handle wheel zoom directly so it works without Ctrl on a mouse or trackpad.
      wheel = event => {
        event.preventDefault(); event.stopPropagation();
        const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? element.current.clientHeight : 1);
        map.cameraDistance = Math.min(50000000, Math.max(100, map.cameraDistance * Math.exp(Math.max(-500, Math.min(500, delta)) * .002)));
      };
      element.current.addEventListener('wheel', wheel, { passive: false, capture: true });
      map.addEventListener('single-tap', event => {
        if (!callbacks.current.onPick) return;
        const coordinate = map.convertPointOnPageToCoordinate(event.pointOnPage);
        const next = { lat: coordinate.latitude, lng: coordinate.longitude, label: 'Выбранное место' };
        lastPicked.current = next; callbacks.current.onPick(next);
      });
      map.addEventListener('select', event => { const id = event.annotation?.data?.id; if (id) callbacks.current.onSelect?.(id); });
      map.addEventListener('drag-end', event => {
        const coordinate = event.coordinate || event.annotation?.coordinate; if (!coordinate) return;
        const next = { lat: coordinate.latitude, lng: coordinate.longitude, label: callbacks.current.location?.label || 'Выбранное место' };
        lastPicked.current = next; callbacks.current.onPick?.(next);
      });
      observer = new ResizeObserver(() => { map.element.style.width = '100%'; map.element.style.height = '100%'; }); observer.observe(element.current);
      setReady(true);
    }).catch(error => { if (active) setError(error.message); });
    return () => { active = false; observer?.disconnect(); if (wheel) element.current?.removeEventListener('wheel', wheel, true); map?.destroy(); kit?.removeEventListener('error', fail); instance.current = null; };
  }, []);
  useEffect(() => {
    if (!ready || !instance.current) return;
    const { map, kit } = instance.current;
    const list = validLocation(location) ? [{ ...location, id: 'selected', count: 1 }] : points.filter(validLocation);
    const annotations = list.map(point => new kit.MarkerAnnotation(new kit.Coordinate(point.lat, point.lng), { title: point.label || 'Место события', subtitle: point.address || '', color: '#8076cc', glyphText: point.count > 1 ? String(point.count) : '●', draggable: Boolean(onPick), data: { id: point.id } }));
    map.addAnnotations(annotations);
    const nextSignature = list.map(point => `${point.id}:${point.lat}:${point.lng}`).join('|');
    const changed = signature.current !== nextSignature; signature.current = nextSignature;
    const justPicked = location && lastPicked.current?.lat === location.lat && lastPicked.current?.lng === location.lng;
    if (changed && annotations.length === 1 && !justPicked) { map.setCenterAnimated(annotations[0].coordinate, true); map.setCameraDistanceAnimated(1400, true); }
    else if (changed && annotations.length > 1) map.showItems(annotations, { animate: true, padding: new kit.Padding(50, element.current.clientWidth > 700 ? 370 : 50, 50, 50) });
    return () => { if (instance.current?.map === map) map.removeAnnotations(annotations); };
  }, [ready, location, points]);
  return <div class="map-canvas-wrap"><div class="map-canvas apple-map" ref={element} aria-label="Apple Maps"/>{!ready && !error && <span class="map-loading" role="status">Загружаю Apple Maps…</span>}{error && <div class="apple-map-error" role="alert"><strong>Apple Maps пока недоступна</strong><p>{error}</p></div>}</div>;
}
