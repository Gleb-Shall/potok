import { useEffect, useMemo, useState } from 'preact/hooks';
import { MapCanvas, MapSourceSwitch, validLocation } from './MapCanvas.jsx';
import { eventTitle, getType } from '../lib/events.js';
import { Button, dateLabel } from './UI.jsx';
import { minutesToTime } from '../lib/domain.js';
import { useMapProvider } from '../lib/map-settings.js';
import { Icon } from './Icon.jsx';

export default function MapView({ events, data, onOpen }) {
  const [provider, setProvider] = useMapProvider();
  const [selected, setSelected] = useState('');
  const [expanded, setExpanded] = useState(false);
  useEffect(() => { if (!expanded) return; const previous = document.body.style.overflow; document.body.style.overflow = 'hidden'; const escape = event => { if (event.key === 'Escape' && !document.querySelector('dialog[open]')) setExpanded(false); }; window.addEventListener('keydown', escape); return () => { document.body.style.overflow = previous; window.removeEventListener('keydown', escape); }; }, [expanded]);
  const points = useMemo(() => {
    const groups = new Map();
    for (const event of events.filter(item => validLocation(item.location))) {
      const id = `${event.location.lat.toFixed(5)}:${event.location.lng.toFixed(5)}`;
      if (!groups.has(id)) groups.set(id, { ...event.location, id, events: [], count: 0 });
      const point = groups.get(id); point.events.push(event); point.count++;
    }
    return [...groups.values()];
  }, [events]);
  const place = points.find(point => point.id === selected);
  const list = place ? place.events : points.flatMap(point => point.events).sort((a, b) => a.date.localeCompare(b.date) || a.start - b.start);
  return <section class={`events-map-view ${expanded ? 'is-fullscreen' : ''}`}><div class="map-view-source"><MapSourceSwitch provider={provider} onChange={setProvider}/></div><div class="map-view-expand"><Button icon={expanded ? 'shrink' : 'expand'} onClick={() => setExpanded(!expanded)}>{expanded ? 'Свернуть карту' : 'На всё окно'}</Button></div><MapCanvas provider={provider} points={points} onSelect={setSelected}/><aside class="map-events"><header><span class="section-caption">СОБЫТИЯ ЗА ВЫБРАННЫЙ ПЕРИОД</span><h3>{place?.label || 'Места событий'}</h3>{place && <button type="button" class="text-button" onClick={() => setSelected('')}>Все места</button>}</header>
    {list.map(event => <button type="button" class="map-event-row" key={event.id} onClick={() => onOpen(event.id)}><span class="map-event-date">{dateLabel(event.date)} · {minutesToTime(event.start)}</span><strong>{eventTitle(data, event)}</strong><small>{getType(data, event.typeId).icon} {getType(data, event.typeId).name} · {event.location.label}</small><Icon name="right"/></button>)}
    {!list.length && <p class="empty-copy">У событий за этот период ещё нет мест. Добавь место в редакторе события — здесь появится метка.</p>}
    <p class="quiet-note">Без места: {events.filter(event => !validLocation(event.location)).length}</p>
  </aside></section>;
}
