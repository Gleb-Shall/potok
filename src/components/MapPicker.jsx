import { useEffect, useId, useRef, useState } from 'preact/hooks';
import { MapCanvas, MapSourceSwitch } from './MapCanvas.jsx';
import { searchPlaces, resolvePlace, reversePlace, validLocation } from '../lib/places.js';
import { Modal, Field, Button, ErrorMessage } from './UI.jsx';
import { Icon } from './Icon.jsx';
import { getDeviceLocation } from '../lib/device-location.js';
import { useMapProvider } from '../lib/map-settings.js';

async function requestPlace(controller, delay, run) {
  const timeout = typeof AbortSignal.timeout === 'function' && typeof AbortSignal.any === 'function';
  const signal = timeout
    ? AbortSignal.any([controller.signal, AbortSignal.timeout(delay)])
    : controller.signal;
  const timer = timeout ? undefined : setTimeout(() => {
    controller.abort(new DOMException('Истекло время ожидания', 'TimeoutError'));
  }, delay);
  try {
    const value = await run(signal);
    if (signal.aborted) throw signal.reason;
    return value;
  } catch (error) {
    throw signal.aborted ? signal.reason : error;
  } finally {
    clearTimeout(timer);
  }
}

export default function MapPicker({ value, saved = [], onChange, onClose }) {
  const [provider, setProvider] = useMapProvider();
  const selecting = useRef(null);
  const searching = useRef(null);
  const searchInput = useRef(null);
  const geoRequest = useRef(0);
  const [locating, setLocating] = useState(false);
  const [mapExpanded, setMapExpanded] = useState(false);
  const [focusRequest, setFocusRequest] = useState(0);
  const [resolving, setResolving] = useState(false);
  const [addressBusy, setAddressBusy] = useState(false);
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
    searching.current = controller;
    setBusy(true); setError(''); setSearched(false);
    const debounce = setTimeout(async () => {
      try {
        const matches = await requestPlace(controller, 10000, signal => searchPlaces(searchTerm, signal, provider));
        if (searching.current === controller) { setResults(matches); setSearched(true); }
      } catch (error) {
        if (searching.current === controller) setError(error.name === 'TimeoutError' ? 'Поиск не ответил. Попробуй ещё раз или выбери точку на карте.' : error.message);
      } finally {
        if (searching.current === controller) { searching.current = null; setBusy(false); }
      }
    }, 350);
    return () => {
      if (searching.current === controller) searching.current = null;
      clearTimeout(debounce);
      controller.abort();
    };
  }, [searchTerm, tab, provider]);
  useEffect(() => () => { selecting.current?.abort(); selecting.current = null; geoRequest.current++; }, []);

  const places = [...new Map(saved.filter(validLocation).map(item => [`${item.lat.toFixed(5)}:${item.lng.toFixed(5)}`, item])).values()];
  const list = tab === 'saved' ? places.filter(item => `${item.label} ${item.address || ''}`.toLocaleLowerCase('ru').includes(query.toLocaleLowerCase('ru'))) : results;
  const expanded = open && list.length > 0;
  const cancelLocation = () => { geoRequest.current++; setLocating(false); };
  const cancelSearch = () => {
    const previous = searching.current;
    searching.current = null;
    previous?.abort();
    setBusy(false);
  };
  const cancelSelection = () => {
    selecting.current?.abort();
    selecting.current = null;
    setResolving(false);
    setAddressBusy(false);
  };
  const changeQuery = text => {
    setOpen(true);
    if (text === query && text === searchTerm) return;
    cancelLocation();
    cancelSearch();
    cancelSelection();
    setQuery(text); setActive(-1); setResults([]); setError(''); setSearched(false);
    setSearchTerm(composing.current ? '' : text);
  };
  const applyLocation = item => {
    cancelSearch();
    setLocation(item); setQuery(item.label); setSearchTerm(''); setResults([]); setOpen(false); setActive(-1); setError(''); setSearched(false);
  };
  const choose = async item => {
    cancelLocation(); setFocusRequest(value => value + 1);
    cancelSelection();
    if (validLocation(item)) { applyLocation(item); return; }
    const controller = new AbortController(); selecting.current = controller;
    setResolving(true); setError('');
    try {
      const resolved = await requestPlace(controller, 12000, signal => resolvePlace(item, signal));
      if (selecting.current === controller) applyLocation(resolved);
    } catch (error) { if (selecting.current === controller) setError(error.name === 'TimeoutError' ? 'Не удалось загрузить место. Попробуй ещё раз.' : error.message); }
    finally { if (selecting.current === controller) {selecting.current=null;setResolving(false);} }
  };
  const pickPoint = async (point, options = {}) => {
    cancelLocation(); if (options.focus) setFocusRequest(value => value + 1);
    selecting.current?.abort();
    const controller = new AbortController(); selecting.current = controller;
    applyLocation(point); setResolving(true); setAddressBusy(true);
    try {
      const resolved = await requestPlace(controller, 6000, signal => reversePlace(point, signal, provider));
      if (selecting.current !== controller) return;
      if (!resolved) { setError('Адрес для этой точки не найден. Можно сохранить координаты или указать название вручную.'); return; }
      setLocation(previous => ({ ...resolved, label: previous?.labelIsCustom ? previous.label : resolved.label, labelIsCustom: Boolean(previous?.labelIsCustom) }));
      setQuery(resolved.label);
    } catch (error) {
      if (selecting.current === controller) setError(error.name === 'TimeoutError' ? 'Адрес не удалось получить вовремя. Можно сохранить метку с координатами.' : 'Не удалось определить адрес. Можно сохранить метку с координатами или указать название вручную.');
    } finally {
      if (selecting.current === controller) { selecting.current = null; setResolving(false); setAddressBusy(false); }
    }
  };
  const locate = async () => {
    const request = ++geoRequest.current;
    setLocating(true); setError('');
    try {
      const point = await getDeviceLocation();
      if (request === geoRequest.current) { setLocating(false); await pickPoint(point, { focus: true }); }
    } catch (error) { if (request === geoRequest.current) { setError(error.message); setLocating(false); } }
  };
  const resetSearchResults = () => {
    cancelLocation();
    cancelSearch();
    cancelSelection();
    setResults([]); setOpen(true); setError(''); setActive(-1); setSearched(false);
  };
  const switchTab = target => {
    if (target === tab) return;
    resetSearchResults();
    setTab(target); setQuery(''); setSearchTerm('');
  };
  const switchProvider = next => {
    if (next === provider) return;
    resetSearchResults();
    setProvider(next);
  };
  const keyboard = event => {
    if (event.isComposing || composing.current) return;
    if (event.key === 'Escape' && expanded) { event.preventDefault(); event.stopPropagation(); setOpen(false); return; }
    if (event.key === 'ArrowDown' && list.length) { event.preventDefault(); setOpen(true); setActive(previous => (previous + 1) % list.length); }
    if (event.key === 'ArrowUp' && list.length) { event.preventDefault(); setOpen(true); setActive(previous => previous <= 0 ? list.length - 1 : previous - 1); }
    if (event.key === 'Enter') { event.preventDefault(); if (expanded) choose(list[active < 0 ? 0 : active]); }
  };
  return <Modal title="Выбрать место" wide onClose={onClose} className="map-picker-modal" fullscreen={mapExpanded} onEscape={() => mapExpanded ? setMapExpanded(false) : onClose()}>
    <MapSourceSwitch provider={provider} onChange={switchProvider}/>
    <div class="section-switch place-tabs" role="group" aria-label="Поиск мест"><button type="button" aria-pressed={tab === 'search'} onClick={() => switchTab('search')}>Найти место</button><button type="button" aria-pressed={tab === 'saved'} onClick={() => switchTab('saved')}>Мои места <span>{places.length}</span></button></div>
    <div class="place-search-wrap" onFocusOut={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
      <form class="place-search" onSubmit={event => event.preventDefault()}>
        <div class="place-search-control">
          <Icon name="search"/>
          <input ref={searchInput} role="combobox" aria-label="Адрес или название места" aria-autocomplete="list"
            aria-expanded={expanded} aria-controls={listId} aria-activedescendant={expanded && active >= 0 ? `${listId}-${active}` : undefined}
            autoComplete="off" placeholder="Название, адрес и город" value={query} maxLength="300"
            onFocus={() => setOpen(true)} onInput={event => changeQuery(event.currentTarget.value)} onKeyDown={keyboard}
            onCompositionStart={() => { composing.current = true; }}
            onCompositionEnd={event => { composing.current = false; changeQuery(event.currentTarget.value); }}/>
          {(busy || resolving) && <span class="search-spinner" role="status" aria-label="Ищу места"/>}
          {query && <button class="search-clear" type="button" aria-label="Очистить поиск" onClick={() => {
            changeQuery('');
            searchInput.current?.focus();
          }}><Icon name="close"/></button>}
        </div>
      </form>
      <div class="place-results" id={listId} role="listbox" aria-label="Подсказки мест" hidden={!expanded}>{expanded && list.map((item, index) => <button type="button" role="option" id={`${listId}-${index}`} aria-selected={active === index} tabIndex="-1" key={item.id || `${item.lat}:${item.lng}:${index}`} onMouseEnter={() => setActive(index)} onClick={() => choose(item)}><span class="place-result-pin"><Icon name="pin"/></span><span><strong>{item.label}</strong><small>{item.address || (validLocation(item) ? `${item.lat.toFixed(5)}, ${item.lng.toFixed(5)}` : 'Уточнить место')}</small></span><Icon name="right"/></button>)}</div>
      {open && searched && !busy && !error && !list.length && <p class="place-search-status" role="status">Место не найдено. Добавь город или выбери точку на карте.</p>}
    </div>
    <ErrorMessage error={error}/>
    {tab === 'saved' && !list.length && <p class="quiet-note">Здесь появятся места из сохранённых событий.</p>}
    <div class="place-map">
      <MapCanvas provider={provider} location={location} onPick={pickPoint} focusRequest={focusRequest}/>
      <div class="map-actions">
        <Button kind="secondary map-icon-action" icon="locate" aria-label="Моё местоположение"
          title="Моё местоположение" aria-busy={locating} disabled={locating} onClick={locate}/>
        <Button kind="secondary map-icon-action" icon={mapExpanded ? 'shrink' : 'expand'}
          aria-label={mapExpanded ? 'Свернуть карту' : 'На весь экран'}
          title={mapExpanded ? 'Свернуть карту' : 'На весь экран'} onClick={() => setMapExpanded(!mapExpanded)}/>
      </div>
      {location && <div class="place-floating-label"><span class="place-result-pin"><Icon name="pin"/></span><span><strong>{location.label}</strong><small role={addressBusy ? 'status' : undefined}>{addressBusy ? 'Определяю адрес…' : location.address || `${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}`}</small></span></div>}
    </div>
    {location && <Field label="Как назвать это место" value={location.label} onChange={label => setLocation(previous => ({ ...previous, label, labelIsCustom: true }))} maxLength="200"/>}
    <div class="place-provider">{provider === 'apple' ? 'Карта и поиск — Apple Maps' : <>Карта — <a href="https://openfreemap.org" target="_blank" rel="noopener noreferrer">OpenFreeMap</a> · поиск — <a href="https://photon.komoot.io" target="_blank" rel="noopener noreferrer">Photon</a></>}</div>
    <div class="modal-footer"><Button onClick={onClose}>Отмена</Button><Button kind="accent" disabled={resolving || !location?.label.trim()} onClick={() => { onChange(location); onClose(); }}>Выбрать место</Button></div>
  </Modal>;
}
