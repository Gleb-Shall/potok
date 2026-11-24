import { MapCanvas } from './MapCanvas.jsx';
import { useEffect, useRef, useState } from 'preact/hooks';
import { Icon } from './Icon.jsx';
import { validLocation } from '../lib/places.js';
import { getDeviceLocation } from '../lib/device-location.js';
import { Button } from './UI.jsx';

export function EventPlacePreview({location,expanded,onExpand}) {
  const toggle = useRef(null);
  const request = useRef(0);
  const [userLocation,setUserLocation] = useState(null);
  const [focusRequest,setFocusRequest] = useState(0);
  const [locating,setLocating] = useState(false);
  const [error,setError] = useState('');
  useEffect(() => () => { request.current++; }, []);
  if(!validLocation(location))return null;
  const href=`https://www.openstreetmap.org/?mlat=${location.lat}&mlon=${location.lng}#map=17/${location.lat}/${location.lng}`;
  const label = expanded ? 'Свернуть карту' : 'Раскрыть карту';
  const locate = async () => {
    const id = ++request.current;
    setError('');
    setLocating(true);
    try {
      const point = await getDeviceLocation();
      if (id===request.current) setUserLocation(point);
    } catch (error) {
      if (id===request.current) setError(error.message);
    } finally {
      if (id===request.current) setLocating(false);
    }
  };
  return <section class={`event-place-preview ${expanded?'is-expanded':''}`} aria-label="Место события">
    <div class="event-place-heading">
      {!expanded && <><span class="place-result-pin"><Icon name="pin"/></span><div><strong>{location.label||'Место события'}</strong><small>{location.address||`${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}`}</small></div></>}
      {expanded && <Button kind="secondary map-icon-action" icon="locate" aria-label="Моё местоположение" title="Моё местоположение"
        disabled={locating} aria-busy={locating} onClick={locate}/>}
      {expanded && userLocation && <Button kind="secondary map-icon-action" icon="pin" aria-label="Место события" title="Место события"
        onClick={()=>setFocusRequest(value=>value+1)}/>}
      {expanded && <a class="button secondary map-icon-action" href={href} target="_blank" rel="noopener noreferrer"
        aria-label="Открыть в картах" title="Открыть в картах"><Icon name="external"/></a>}
      <button ref={toggle} type="button" class={expanded ? 'button secondary map-icon-action' : 'icon-button'}
        aria-label={label} title={label} aria-expanded={expanded} onClick={()=>onExpand(!expanded)}><Icon name={expanded?'shrink':'expand'}/></button>
    </div>
    <div class="event-place-map">
      <div class="event-place-canvas" inert={expanded?undefined:true}><MapCanvas location={location} userLocation={userLocation} focusRequest={focusRequest}/></div>
      {expanded && error && <p class="event-geolocation-error map-error" role="status">{error}</p>}
      {!expanded && <button type="button" class="event-place-open" tabIndex={-1} onClick={()=>{
        toggle.current?.focus({ preventScroll: true });
        onExpand(true);
      }} aria-label={`Раскрыть карту: ${location.label||'место события'}`}/>}
    </div>
  </section>;
}
