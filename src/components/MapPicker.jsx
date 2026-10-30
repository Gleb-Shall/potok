import { useEffect, useId, useRef, useState } from 'preact/hooks';
import { MapCanvas } from './MapCanvas.jsx';
import { searchPlaces, validLocation } from '../lib/places.js';
import { Modal, Field, Button, ErrorMessage } from './UI.jsx';
import { Icon } from './Icon.jsx';

export default function MapPicker({ value, saved = [], onChange, onClose }) {
  const [location, setLocation] = useState(validLocation(value) ? value : null);
  const [query, setQuery] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState([]);
  const [tab, setTab] = useState('search');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [searched, setSearched] = useState(false);
  const composing = useRef(false);
  const listId = useId();

  useEffect(() => {
    if (tab !== 'search' || searchTerm.trim().length < 2) { setBusy(false); return; }
    const controller = new AbortController();
    let current = true;
    let timeout;
    setBusy(true); setError(''); setSearched(false);
    const debounce = setTimeout(async () => {
      timeout = setTimeout(() => controller.abort(), 10000);
      try {
        const matches = await searchPlaces(searchTerm, controller.signal);
        if (current) { setResults(matches); setSearched(true); }
      } catch (error) {
        if (current) setError(controller.signal.aborted ? 'Поиск не ответил. Попробуй ещё раз или выбери точку на карте.' : error.message);
      } finally { clearTimeout(timeout); if (current) setBusy(false); }
    }, 350);
    return () => { current = false; clearTimeout(debounce); clearTimeout(timeout); controller.abort(); };
  }, [searchTerm, tab]);

  const places = [...new Map(saved.filter(validLocation).map(item => [`${item.lat.toFixed(5)}:${item.lng.toFixed(5)}`, item])).values()];
  const list = tab === 'saved' ? places.filter(item => `${item.label} ${item.address || ''}`.toLocaleLowerCase('ru').includes(query.toLocaleLowerCase('ru'))) : results;
  const expanded = open && list.length > 0;
  const changeQuery = text => {
    setQuery(text); setOpen(true); setActive(-1); setResults([]); setError(''); setSearched(false);
    if (!composing.current) setSearchTerm(text);
  };
  const choose = item => {
    setLocation(item); setQuery(item.label); setSearchTerm(''); setResults([]); setOpen(false); setActive(-1); setError(''); setSearched(false);
  };
  const switchTab = target => { setTab(target); setQuery(''); setSearchTerm(''); setResults([]); setOpen(true); setError(''); setActive(-1); setSearched(false); };
  const keyboard = event => {
    if (event.isComposing) return;
    if (event.key === 'Escape' && open) { event.preventDefault(); event.stopPropagation(); setOpen(false); return; }
    if (event.key === 'ArrowDown' && list.length) { event.preventDefault(); setOpen(true); setActive(previous => (previous + 1) % list.length); }
    if (event.key === 'ArrowUp' && list.length) { event.preventDefault(); setOpen(true); setActive(previous => previous <= 0 ? list.length - 1 : previous - 1); }
    if (event.key === 'Enter') { event.preventDefault(); if (expanded) choose(list[active < 0 ? 0 : active]); }
  };
  return <Modal title="Выбрать место" subtitle="Начни вводить адрес или поставь метку на карте." wide onClose={onClose}>
    <div class="place-tabs"><button type="button" class={tab === 'search' ? 'active' : ''} onClick={() => switchTab('search')}>Найти место</button><button type="button" class={tab === 'saved' ? 'active' : ''} onClick={() => switchTab('saved')}>В моих событиях <span>{places.length}</span></button></div>
    <div class="place-search-wrap" onFocusOut={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
      <form class="place-search" onSubmit={event => event.preventDefault()}><label><Icon name="search"/><input autoFocus role="combobox" aria-label="Адрес или название места" aria-autocomplete="list" aria-expanded={expanded} aria-controls={listId} aria-activedescendant={expanded && active >= 0 ? `${listId}-${active}` : undefined} autoComplete="off" placeholder="Название, адрес и город" value={query} onFocus={() => setOpen(true)} onInput={event => changeQuery(event.currentTarget.value)} onKeyDown={keyboard} onCompositionStart={() => { composing.current = true; }} onCompositionEnd={event => { composing.current = false; changeQuery(event.currentTarget.value); }} maxLength="300"/>{busy && <span class="search-spinner" aria-label="Ищу места"/>}{query && <button class="search-clear" type="button" aria-label="Очистить поиск" onClick={() => changeQuery('')}><Icon name="close"/></button>}</label></form>
      {expanded && <div class="place-results" id={listId} role="listbox" aria-label="Подсказки мест">{list.map((item, index) => <button type="button" role="option" id={`${listId}-${index}`} aria-selected={active === index} tabIndex="-1" key={`${item.lat}:${item.lng}:${index}`} onMouseEnter={() => setActive(index)} onClick={() => choose(item)}><span class="place-result-pin"><Icon name="pin"/></span><span><strong>{item.label}</strong><small>{item.address || `${item.lat.toFixed(5)}, ${item.lng.toFixed(5)}`}</small></span><Icon name="right"/></button>)}</div>}
      {open && searched && !busy && !error && !list.length && <p class="place-search-status" role="status">Место не найдено. Добавь город или выбери точку на карте.</p>}
    </div>
    <ErrorMessage error={error}/>
    {tab === 'saved' && !list.length && <p class="quiet-note">Здесь появятся места из сохранённых событий.</p>}
    <div class="place-map"><MapCanvas location={location} onPick={choose}/>{location && <div class="place-floating-label"><span class="place-result-pin"><Icon name="pin"/></span><span><strong>{location.label}</strong><small>{location.address || `${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}`}</small></span></div>}</div>
    <p class="quiet-note">Прокрутка или жест на трекпаде — масштаб. Перетаскивание — движение карты. Нажатие — поставить метку.</p>
    {location && <Field label="Как назвать это место" value={location.label} onChange={label => setLocation(previous => ({ ...previous, label }))} maxLength="200"/>}
    <div class="place-provider">Карта — <a href="https://openfreemap.org" target="_blank" rel="noopener noreferrer">OpenFreeMap</a> · поиск — <a href="https://photon.komoot.io" target="_blank" rel="noopener noreferrer">Photon</a></div>
    <div class="modal-footer"><Button onClick={onClose}>Отмена</Button><Button kind="primary" disabled={!location?.label.trim()} onClick={() => { onChange(location); onClose(); }}>Выбрать место</Button></div>
  </Modal>;
}
