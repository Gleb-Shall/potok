import { MapCanvas } from './MapCanvas.jsx';
import { Icon } from './Icon.jsx';
import { validLocation } from '../lib/places.js';

// A single map instance grows from preview to inspector; no duplicate GPU context.
export function EventPlacePreview({location,expanded,onExpand}) {
  if(!validLocation(location))return null;
  const href=`https://www.openstreetmap.org/?mlat=${location.lat}&mlon=${location.lng}#map=17/${location.lat}/${location.lng}`;
  return <section class={`event-place-preview ${expanded?'is-expanded':''}`} aria-label="Место события">
    <div class="event-place-heading"><span class="place-result-pin"><Icon name="pin"/></span><div><strong>{location.label||'Место события'}</strong><small>{location.address||`${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}`}</small></div><button type="button" class="icon-button" aria-label={expanded?'Свернуть карту':'Раскрыть карту'} aria-expanded={expanded} onClick={()=>onExpand(!expanded)}><Icon name={expanded?'shrink':'expand'}/></button></div>
    <div class="event-place-map"><div class="event-place-canvas" inert={expanded?undefined:true}><MapCanvas location={location}/></div>{!expanded && <button type="button" class="event-place-open" onClick={()=>onExpand(true)} aria-label={`Раскрыть карту: ${location.label||'место события'}`}><span><Icon name="expand"/>Посмотреть на карте</span></button>}</div>
    {expanded && <div class="event-place-footer"><span>Прокрутка — масштаб · перетаскивание — движение карты</span><a href={href} target="_blank" rel="noopener noreferrer">Открыть в картах ↗</a></div>}
  </section>;
}
