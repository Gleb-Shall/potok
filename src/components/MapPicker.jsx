import { useEffect, useRef, useState } from 'preact/hooks';
import { MapCanvas, validLocation } from './MapCanvas.jsx';
import { Modal, Field, Button, ErrorMessage } from './UI.jsx';
import { Icon } from './Icon.jsx';

const cache = new Map();
const searchURL = import.meta.env.VITE_MAP_SEARCH_URL || 'https://photon.komoot.io/api/';
export default function MapPicker({ value, saved = [], onChange, onClose }) {
  const [location, setLocation] = useState(validLocation(value) ? value : null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [tab, setTab] = useState('search');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const controller = useRef(null);
  const requestId = useRef(0);
  useEffect(() => () => { requestId.current++; controller.current?.abort(); }, []);
  const search = async event => {
    event.preventDefault();
    const text = query.trim(); if (text.length < 3 || busy) return;
    const id = ++requestId.current;
    controller.current?.abort(); controller.current = new AbortController();
    const signal = controller.current.signal;
    setBusy(true); setError(''); setResults([]);
    const timer = setTimeout(() => controller.current?.abort(), 12000);
    try {
      let matches = cache.get(text);
      if (!matches) {
        const url = new URL(searchURL); url.searchParams.set('q', text); url.searchParams.set('limit', '6');
        const response = await fetch(url, { signal });
        if (!response.ok) throw new Error('Поиск временно недоступен. Можно выбрать точку на карте.');
        const body = await response.json();
        matches = (body.features || []).map(item => {
          const info = item.properties || {};
          const address = [info.street, info.housenumber, info.city || info.town || info.village, info.country].filter(Boolean).join(', ');
          return { lat: item.geometry?.coordinates?.[1], lng: item.geometry?.coordinates?.[0], label: info.name || address || 'Место', address };
        }).filter(validLocation);
        if (cache.size >= 50) cache.delete(cache.keys().next().value);
        cache.set(text, matches);
      }
      if (id !== requestId.current) return;
      setResults(matches); if (!matches.length) setError('Место не найдено. Добавь город в запрос или отметь точку на карте.');
    } catch (error) { if (id === requestId.current) setError(signal.aborted ? 'Поиск не ответил. Попробуй ещё раз или выбери точку на карте.' : error.message); }
    finally { clearTimeout(timer); if (id === requestId.current) setBusy(false); }
  };
  const places = [...new Map(saved.filter(validLocation).map(item => [`${item.lat.toFixed(5)}:${item.lng.toFixed(5)}`, item])).values()];
  const list = tab === 'saved' ? places.filter(item => `${item.label} ${item.address || ''}`.toLocaleLowerCase('ru').includes(query.toLocaleLowerCase('ru'))) : results;
  return <Modal title="Выбрать место" subtitle="Найди адрес или поставь метку на карте." wide onClose={onClose}>
    <div class="place-tabs"><button type="button" class={tab === 'search' ? 'active' : ''} onClick={() => setTab('search')}>Найти место</button><button type="button" class={tab === 'saved' ? 'active' : ''} onClick={() => setTab('saved')}>В моих событиях <span>{places.length}</span></button></div>
    <form class="place-search" onSubmit={search}><label><Icon name="search"/><input aria-label="Адрес или название места" placeholder="Название, адрес и город" value={query} onInput={event => setQuery(event.currentTarget.value)} minLength="3" maxLength="300"/></label>{tab === 'search' && <button type="submit" class="button secondary" disabled={busy || query.trim().length < 3}>{busy ? 'Ищу…' : 'Найти'}</button>}</form>
    <ErrorMessage error={error}/>
    {list.length > 0 && <div class="place-results">{list.map((item, index) => <button type="button" key={`${item.lat}:${item.lng}:${index}`} onClick={() => { setLocation(item); setResults([]); setTab('search'); }}><span class="place-result-pin"><Icon name="pin"/></span><span><strong>{item.label}</strong><small>{item.address || `${item.lat.toFixed(5)}, ${item.lng.toFixed(5)}`}</small></span><Icon name="right"/></button>)}</div>}
    {tab === 'saved' && !list.length && <p class="quiet-note">Здесь появятся места из сохранённых событий.</p>}
    <div class="place-map"><MapCanvas location={location} onPick={setLocation}/>{location && <div class="place-floating-label"><span class="place-result-pin"><Icon name="pin"/></span><span><strong>{location.label}</strong><small>{location.address || `${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}`}</small></span></div>}</div>
    <p class="quiet-note">Нажми на карту, чтобы поставить метку. Метку можно передвигать.</p>
    {location && <Field label="Как назвать это место" value={location.label} onChange={label => setLocation(previous => ({ ...previous, label }))} maxLength="200"/>}
    <div class="place-provider">Поиск — <a href="https://photon.komoot.io" target="_blank" rel="noopener noreferrer">Photon</a> · карта — OpenStreetMap</div>
    <div class="modal-footer"><Button onClick={onClose}>Отмена</Button><Button kind="primary" disabled={!location?.label.trim()} onClick={() => { onChange(location); onClose(); }}>Выбрать место</Button></div>
  </Modal>;
}
