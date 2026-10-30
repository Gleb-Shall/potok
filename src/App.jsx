import { useEffect, useRef, useState } from 'preact/hooks';
import { lazy, Suspense } from 'preact/compat';
import { Icon } from './components/Icon.jsx';
import { Button, Search, Check, dateLabel, initials, money, dayNames, longDays } from './components/UI.jsx';
import { EventCard } from './components/EventCard.jsx';
import { EventEditor } from './components/EventEditor.jsx';
import { EventDetails } from './components/EventDetails.jsx';
import { StudentEditor, StudentDetails } from './components/StudentEditor.jsx';
import { TypeEditor } from './components/TypeEditor.jsx';
import { DeleteDialog } from './components/DeleteDialog.jsx';
import { MoveEditor } from './components/MoveEditor.jsx';
import { RecordEditor, RecordDetails } from './components/RecordEditor.jsx';
import { Modal } from './components/UI.jsx';
const MapView = lazy(() => import('./components/MapView.jsx'));
import { addDays, todayISO, weekdayOf, minutesToTime } from './lib/domain.js';
import { getType, getStudent, projectWeek, eventTitle, eventColor, eventMatches, moveEvent, assertNoConflict, normalizeData, calendarRange, allRecords, RECORD_KINDS, recordKind } from './lib/events.js';
import { loadData, persistData, demoData, exportData } from './lib/storage.js';

const NAV = [['schedule', 'calendar', 'Расписание'], ['students', 'users', 'Записи'], ['types', 'settings', 'Шаблоны'], ['transfers', 'arrows', 'Переносы']];
const TITLES = { schedule: 'Расписание', students: 'Записи', types: 'Шаблоны', transfers: 'Переносы', settings: 'Настройки' };
const SUBTITLES = { schedule: 'Задачи, встречи и время в одном потоке', students: 'Люди, предметы и проекты — общие сведения для твоих событий', types: 'Выбери, какие поля нужны твоим событиям', transfers: 'Новое время и вся история изменений', settings: 'Твоё пространство и данные' };

export function App() {
  const today = todayISO();
  const [session, setSession] = useState(() => { const mode = localStorage.getItem('tutor-schedule:mode') === 'personal' ? 'personal' : 'demo'; return { mode, data: loadData(mode) }; });
  const { data, mode } = session;
  const [view, setView] = useState('schedule');
  const [week, setWeek] = useState(today);
  const [rangeView, setRangeView] = useState('week');
  const [mapView, setMapView] = useState(false);
  const [compact, setCompact] = useState(true);
  const [cardOverrides, setCardOverrides] = useState({});
  const [recordFilter, setRecordFilter] = useState('');
  const [selectedDate, setSelectedDate] = useState(today);
  const [query, setQuery] = useState('');
  const [filterType, setFilterType] = useState('');
  const [showGhosts, setShowGhosts] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  const [dialog, setDialog] = useState(null);
  const [deletion, setDeletion] = useState(null);
  const [notice, setNotice] = useState(null);
  const [undo, setUndo] = useState(null);
  const [stale, setStale] = useState(false);
  const [dropTarget, setDropTarget] = useState('');
  const dragId = useRef(null);
  const importRef = useRef(null);
  const range = calendarRange(week, rangeView);
  const projection = projectWeek(data, range.start, range.count);
  const days = Array.from({ length: range.count }, (_, index) => addDays(range.start, index));
  const notify = (text, canUndo = false) => setNotice({ text, canUndo });
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(null), 7000); return () => clearTimeout(timer); }, [notice]);
  useEffect(() => {
    const listener = event => { if (event.key === `tutor-schedule:${mode}:v2`) setStale(true); };
    window.addEventListener('storage', listener); return () => window.removeEventListener('storage', listener);
  }, [mode]);

  const commit = (next, message, date) => {
    const saved = persistData(mode, next, data.revision || 0);
    if (filterType && !next.types.some(type => type.id === filterType)) setFilterType('');
    setDeletion(null); setUndo(data); setSession({ mode, data: saved }); setDialog(null); setStale(false);
    if (date) { if (date < range.start || date > range.end) setWeek(date); setSelectedDate(date); }
    notify(message, true);
  };
  const attempt = action => { try { action(); } catch (error) { notify(error.message); } };
  const close = () => setDialog(null);
  const newEvent = (date = selectedDate, studentId = '') => {
    const typeId = studentId ? (data.types.find(type => !type.archived && recordKind(type) === 'student') || data.types.find(type => !type.archived && recordKind(type) === 'any'))?.id : filterType || data.types.find(type => !type.archived && type.id === 'personal')?.id || data.types.find(type => !type.archived)?.id;
    if (!typeId) { setView('types'); notify('Сначала создай или верни из архива тип карточки.'); return; }
    const student = getStudent(data, studentId);
    setDialog({ kind: 'event-editor', date, typeId, draft: student ? { studentId, recordId: studentId, title: student.name, color: student.color, fields: { rate: student.rate } } : undefined });
  };
  const findEvent = id => data.events.find(event => event.id === id) || projection.events.find(event => event.id === id);
  const openEvent = id => { const event = findEvent(id); if (event) setDialog({ kind: 'event-details', event }); };
  const editEvent = (event, date) => setDialog({ kind: 'event-editor', original: event, date });
  const newEventForRecord = record => {
    if (record.kind === 'student') { newEvent(selectedDate, record.id); return; }
    const type = data.types.find(type => !type.archived && recordKind(type) === record.kind) || data.types.find(type => !type.archived && recordKind(type) === 'any');
    if (!type) { setView('types'); close(); notify('В конструкторе выбери для типа связь с этой категорией записей.'); return; }
    setDialog({ kind: 'event-editor', date: selectedDate, typeId: type.id, draft: { recordId: record.id, title: record.name, color: record.color } });
  };
  const switchView = target => { setView(target); setQuery(''); };
  const switchMode = nextMode => {
    const next = loadData(nextMode); localStorage.setItem('tutor-schedule:mode', nextMode);
    setSession({ mode: nextMode, data: next }); setDialog(null); setDeletion(null); setUndo(null); setStale(false); setQuery(''); setFilterType('');
    notify(nextMode === 'personal' ? 'Открыто твоё расписание. Демо хранится отдельно.' : 'Открыт отдельный пример расписания.');
  };
  const navigateWeek = delta => {
    if (rangeView === 'month') { const next = new Date(week.slice(0, 7) + '-01T00:00:00Z'); next.setUTCMonth(next.getUTCMonth() + delta); const date = next.toISOString().slice(0, 10); setWeek(date); setSelectedDate(date); }
    else { const offset = Math.max(0, days.indexOf(selectedDate)); const next = addDays(range.start, delta * range.count); setWeek(next); setSelectedDate(addDays(next, offset)); }
  };
  const moveDialog = (event, date) => setDialog({ kind: 'move-editor', event, date });
  const statusEvent = (event, status) => attempt(() => {
    if (status === 'planned' && !event.date) { moveDialog(event); return; }
    if (status === 'cancelled' && !confirm('Отменить только это событие? История и остальные повторы сохранятся.')) return;
    const next = status === 'pending' ? moveEvent(event, null, event.start, event.duration) : { ...event, status };
    if (status === 'planned') assertNoConflict(data, next);
    commit({ ...data, events: [...data.events.filter(item => item.id !== next.id), next] }, status === 'pending' ? 'Событие ждёт нового времени' : 'Статус события изменён');
  });
  const drop = (event, target) => {
    event.preventDefault(); setDropTarget('');
    const id = dragId.current || event.dataTransfer.getData('text/plain'); dragId.current = null;
    const item = findEvent(id); if (!item) return;
    if (target === 'pending') statusEvent(item, 'pending'); else moveDialog(item, target);
  };
  const dropProps = target => ({ onDragOver: event => { if (dragId.current) { event.preventDefault(); setDropTarget(target); } }, onDragLeave: event => { if (!event.currentTarget.contains(event.relatedTarget)) setDropTarget(''); }, onDrop: event => drop(event, target) });
  const pendingCard = event => <button key={event.id} class="pending-card" onClick={() => moveDialog(event)}><span class={`student-avatar color-${eventColor(data, event)}`}>{getType(data, event.typeId).icon}</span><span><strong>{eventTitle(data, event)}</strong><small>Было {dateLabel(event.originalDate || event.anchorDate)} · {minutesToTime(event.originalStart ?? event.start)}</small></span><span class="pending-choose">Выбрать время <Icon name="arrow"/></span></button>;

  function Schedule() {
    const filtered = projection.events.filter(event => eventMatches(data, event, query, filterType));
    const hours = filtered.reduce((total, event) => total + event.duration, 0) / 60;
    return <><section class="schedule-panel" aria-label="Расписание событий">
      <div class="calendar-toolbar"><div class="week-navigation"><button class="icon-button" aria-label="Предыдущий период" onClick={() => navigateWeek(-1)}><Icon name="left"/></button><h2>{rangeView === 'month' ? dateLabel(week, { day: undefined, month: 'long', year: 'numeric' }) : `${dateLabel(range.start)} — ${dateLabel(range.end, { year: 'numeric' })}`}</h2><button class="icon-button" aria-label="Следующий период" onClick={() => navigateWeek(1)}><Icon name="right"/></button><Button kind="small secondary" onClick={() => { setWeek(today); setSelectedDate(today); }}>Сегодня</Button></div>
        <div class="range-switch" aria-label="Период расписания">{[['week', 'Неделя'], ['fortnight', '2 недели'], ['month', 'Месяц']].map(([id, label]) => <button type="button" key={id} aria-pressed={rangeView === id} class={rangeView === id ? 'active' : ''} onClick={() => { setRangeView(id); setWeek(selectedDate); }}>{label}</button>)}</div></div>
      <div class="schedule-controls"><div class="calendar-filters"><select aria-label="Тип событий" class="type-filter" value={filterType} onChange={event => setFilterType(event.currentTarget.value)}><option value="">Все типы</option>{data.types.map(type => <option key={type.id} value={type.id}>{type.icon} {type.name}</option>)}</select><Search value={query} onChange={setQuery}/></div><div class="schedule-view-controls"><span class="period-count">{filtered.length} событий · {hours.toLocaleString('ru-RU', { maximumFractionDigits: 1 })} ч</span><Button icon={mapView ? 'calendar' : 'pin'} onClick={() => setMapView(!mapView)}>{mapView ? 'Расписание' : 'На карте'}</Button>{!mapView && <Button onClick={() => { setCompact(!compact); setCardOverrides({}); }}>{compact ? 'Раскрыть карточки' : 'Свернуть карточки'}</Button>}</div></div>
      {mapView ? <Suspense fallback={<p class="empty-copy">Загружаю карту…</p>}><MapView events={filtered} data={data} onOpen={openEvent}/></Suspense> : <>
      <div class="mobile-days" aria-label="Дни периода">{days.map(date => <button key={date} class={`mobile-day ${date === selectedDate ? 'selected' : ''}`} onClick={() => setSelectedDate(date)}><span>{dayNames[weekdayOf(date)]}</span><strong>{Number(date.slice(8))}</strong></button>)}</div>
      <div class={`calendar-scroll range-${rangeView}`}><div class={`calendar-grid calendar-${rangeView}`}>{days.map(date => {
        const events = filtered.filter(event => event.date === date);
        const ghosts = showGhosts ? projection.ghosts.filter(event => event.date === date && eventMatches(data, event, query, filterType)) : [];
        const cards = [...events, ...ghosts].sort((a, b) => a.start - b.start);
        return <section key={date} class={`day-column ${date === selectedDate ? 'mobile-selected' : ''} ${date === today ? 'is-today' : ''} ${rangeView === 'month' && date.slice(0, 7) !== week.slice(0, 7) ? 'outside-month' : ''} ${dropTarget === date ? 'drop-target' : ''}`} {...dropProps(date)} aria-label={`${longDays[weekdayOf(date)]}, ${dateLabel(date)}`}>
          <header class="day-header"><span>{dayNames[weekdayOf(date)]} · {dateLabel(date)}</span><div><strong>{Number(date.slice(8))}</strong>{date === today && <span class="today-tag">сегодня</span>}</div></header>
          <div class="day-body">{cards.map(event => <EventCard key={`${event.id}:${event.ghost ? 'ghost' : 'live'}`} event={event} data={data} onOpen={openEvent} onDelete={event => setDeletion({ kind: 'event', value: event })} expanded={cardOverrides[event.id] ?? !compact} onToggle={id => setCardOverrides(previous => ({ ...previous, [id]: !(previous[id] ?? !compact) }))} onDragStart={id => { dragId.current = id; }} onDragEnd={() => { dragId.current = null; setDropTarget(''); }}/>) }
          {!cards.length && <div class="free-day"><span>{query || filterType ? 'Нет событий' : 'Свободно'}</span></div>}<button class="add-slot" onClick={() => newEvent(date)} aria-label={`Добавить событие на ${dateLabel(date)}`}><Icon name="plus"/>Событие</button></div>
        </section>;
      })}</div></div><div class="calendar-bottom"><span class="drag-hint"><Icon name="arrows"/>Перетащи в другой день — останется выбрать время</span><Check checked={showGhosts} onChange={setShowGhosts}>Старое время</Check></div></>}
      </section><section class={`pending-panel ${dropTarget === 'pending' ? 'drop-target' : ''}`} {...dropProps('pending')}><div class="pending-heading"><span class="pending-symbol"><Icon name="arrows"/></span><div><h2>Ждут нового времени <span class="count-pill">{projection.pending.length}</span></h2><p>Сюда можно перетащить событие, если новая дата ещё не известна</p></div></div>{projection.pending.length ? <div class="pending-cards">{projection.pending.map(pendingCard)}</div> : <span class="all-good"><Icon name="check"/>Все события на своих местах</span>}</section></>;
  }
  function Students() {
    const records = allRecords(data);
    const filtered = records.filter(record => (!recordFilter || record.kind === recordFilter) && `${record.name} ${record.subject || record.subtitle || ''}`.toLocaleLowerCase('ru').includes(query.toLocaleLowerCase('ru')));
    return <section class="students-panel"><div class="section-toolbar"><h2>Общие записи <span class="count-pill">{records.length}</span></h2><div class="calendar-filters"><select aria-label="Категория записей" class="type-filter" value={recordFilter} onChange={event => setRecordFilter(event.currentTarget.value)}><option value="">Все категории</option>{[...new Set([...Object.keys(RECORD_KINDS), ...records.map(item => item.kind)])].map(kind => <option value={kind} key={kind}>{RECORD_KINDS[kind] || kind}</option>)}</select><Search value={query} onChange={setQuery} placeholder="Поиск записей"/></div></div>
      <p class="directory-note">Запись хранит общие сведения, событие — конкретную дату и время. Например: один предмет → много пар.</p><div class="student-grid">{filtered.map(record => <button class="student-tile" key={record.id} onClick={() => setDialog(record.kind === 'student' ? { kind: 'student-details', student: record } : { kind: 'record-details', record })}><span class={`student-avatar large color-${record.color}`}>{initials(record.name)}</span><span class="record-kind-label">{RECORD_KINDS[record.kind] || record.kind}</span><strong>{record.name}</strong><span>{record.subject || record.subtitle || 'Общие сведения'}</span><div class="student-tile-footer">{record.kind === 'student' ? <span>{money(record.rate)} <small>/ урок</small></span> : <span>{record.details?.length || 0} сведений</span>}<span>{data.series.filter(series => !series.archived && (series.recordId || series.studentId) === record.id).length} расписаний</span></div></button>)}{!filtered.length && <div class="empty-state"><h3>{query ? 'Ничего не нашли' : 'Здесь будут твои записи'}</h3><p>Создай ученика, предмет или другую общую карточку.</p><Button kind="primary" icon="plus" onClick={() => setDialog({ kind: 'record-choice' })}>Добавить запись</Button></div>}</div></section>;
  }
  function Types() {
    return <section class="students-panel"><div class="section-toolbar"><h2>Шаблоны твоих событий</h2><Check checked={showArchived} onChange={setShowArchived}>Показать архивные</Check></div><div class="student-grid">{data.types.filter(type => showArchived || !type.archived).map(type => <article key={type.id} class={`type-tile ${type.archived ? 'archived-type' : ''}`}><span class={`student-avatar large color-${type.color}`}>{type.icon}</span><h3>{type.name}{type.archived ? ' · архив' : ''}</h3><p>{type.fields.filter(field => !field.archived).length} доп. полей{recordKind(type) ? ' · связанные записи' : ''}</p><div class="type-field-tags">{type.fields.filter(field => !field.archived).map(field => <span key={field.id}>{field.label}{field.required ? ' *' : ''}</span>)}</div><div class="type-actions"><Button onClick={() => setDialog({ kind: 'type-editor', original: type })}>Редактировать</Button><button type="button" class="icon-button danger-text" aria-label={`Удалить шаблон «${type.name}»`} onClick={() => setDeletion({ kind: 'type', value: type })}><Icon name="trash"/></button><button class="text-button" onClick={() => setDialog({ kind: 'type-editor', original: { ...structuredClone(type), id: crypto.randomUUID(), name: `${type.name} (копия)`, archived: false, version: 0 } })}>Копия</button><button class="text-button" onClick={() => attempt(() => commit({ ...data, types: data.types.map(item => item.id === type.id ? { ...item, archived: !item.archived } : item) }, type.archived ? 'Тип возвращён из архива' : 'Тип скрыт для новых событий. Старые события сохранены.'))}>{type.archived ? 'Вернуть' : 'В архив'}</button></div></article>)}</div><p class="quiet-note">Скрытые поля и архивные типы сохраняют данные уже созданных событий. Дата, время, повторение и переносы общие для всех карточек.</p></section>;
  }
  function Transfers() {
    const changed = data.events.filter(event => event.history?.length || event.status === 'cancelled').sort((a, b) => (b.history?.at(-1)?.at || '').localeCompare(a.history?.at(-1)?.at || ''));
    return <section class="transfer-page"><div class="section-toolbar"><h2>Ждут согласования <span class="count-pill">{projection.pending.length}</span></h2></div><div class="pending-list">{projection.pending.map(pendingCard)}{!projection.pending.length && <p class="empty-copy">Событий без новой даты нет.</p>}</div><div class="section-toolbar"><h2>История изменений</h2></div><div class="history-list">{changed.map(event => <button key={event.id} class="history-row" onClick={() => openEvent(event.id)}><span class={`student-avatar color-${eventColor(data, event)}`}>{getType(data, event.typeId).icon}</span><span><strong>{eventTitle(data, event)}</strong><small>Было {dateLabel(event.originalDate || event.anchorDate)} · {minutesToTime(event.originalStart ?? event.start)}</small></span><Icon name="arrow"/><span class="history-destination">{event.status === 'pending' ? 'Время не выбрано' : event.status === 'cancelled' ? 'Отменено' : `${dateLabel(event.date)} · ${minutesToTime(event.start)}`}</span></button>)}{!changed.length && <p class="empty-copy">Здесь будут переносы и отмены всех типов событий.</p>}</div></section>;
  }
  async function importFile(file) {
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()); const restored = normalizeData(parsed.data || parsed);
      if (!confirm('Заменить текущее расписание данными из копии? Последнее действие можно будет отменить.')) return;
      commit(restored, 'Резервная копия восстановлена');
    } catch (error) { notify(`Не удалось восстановить копию: ${error.message}`); }
    finally { if (importRef.current) importRef.current.value = ''; }
  }
  function Settings() {
    return <section class="settings-panel"><article class="settings-card"><span class="section-caption">ХРАНЕНИЕ</span><h2>Локальная версия</h2><p>Данные сохраняются в этом браузере. Firebase, вход в аккаунт и внешний API подключим отдельным этапом.</p><div class="settings-actions"><Button icon="download" onClick={() => exportData(mode, data)}>Скачать резервную копию</Button><Button onClick={() => importRef.current.click()}>Восстановить из копии</Button><input type="file" accept="application/json,.json" hidden ref={importRef} onChange={event => importFile(event.currentTarget.files[0])}/></div></article><article class="settings-card"><span class="section-caption">РАСПИСАНИЕ</span><h2>{mode === 'demo' ? 'Демонстрационный пример' : 'Твои события'}</h2><p>Демо и личные записи хранятся отдельно. Переключение не удаляет данные.</p><Button onClick={() => attempt(() => switchMode(mode === 'demo' ? 'personal' : 'demo'))}>{mode === 'demo' ? 'Перейти к своему расписанию' : 'Открыть демо'}</Button>{mode === 'demo' && <button class="text-button" onClick={() => attempt(() => { if (confirm('Восстановить вымышленный пример? Личное расписание не изменится.')) commit(demoData(), 'Демо восстановлено'); })}>Восстановить пример</button>}</article><article class="settings-card"><span class="section-caption">ПОВТОРЕНИЯ И ПЕРЕНОСЫ</span><h2>Одно событие или всё расписание</h2><p>В редакторе повторяющегося события выбери, изменить только этот экземпляр или его и последующие. Разовый перенос сохраняет обычное время других недель. История остаётся внутри карточки.</p></article><article class="settings-card"><span class="section-caption">СВОИ КАРТОЧКИ</span><h2>Поля под твои задачи</h2><p>В «Шаблонах» можно добавлять поля, менять порядок, обязательность и видимость. Использованные поля скрываются с сохранением значений.</p><Button onClick={() => switchView('types')}>Открыть конструктор</Button></article></section>;
  }

  const body = view === 'schedule' ? Schedule() : view === 'students' ? Students() : view === 'types' ? Types() : view === 'transfers' ? Transfers() : Settings();
  return <><div class="layout"><aside class="sidebar"><a class="brand" href="#" onClick={event => { event.preventDefault(); switchView('schedule'); }}><span class="brand-mark"><svg viewBox="0 0 32 32" aria-hidden="true"><path d="M4 10c5-6 9 6 14 0s7-1 10 0M4 17c5-6 9 6 14 0s7-1 10 0M4 24c5-6 9 6 14 0s7-1 10 0"/></svg></span><span>поток<span class="brand-dot">.</span></span></a><div class="workspace-label">ЛИЧНОЕ ПРОСТРАНСТВО</div><nav aria-label="Разделы">{NAV.map(([id, icon, label]) => <button key={id} class={`nav-item ${view === id ? 'active' : ''}`} aria-current={view === id ? 'page' : undefined} onClick={() => switchView(id)}><Icon name={icon}/><span>{label}</span>{id === 'transfers' && projection.pending.length > 0 && <span class="nav-count amber">{projection.pending.length}</span>}</button>)}</nav><div class="sidebar-note"><span class="tiny-spark">✳</span><p>Освободи голову.<br/>Планы уже здесь.</p></div><div class="sidebar-bottom"><button class={`nav-item ${view === 'settings' ? 'active' : ''}`} onClick={() => switchView('settings')}><Icon name="settings"/><span>Настройки</span></button><div class="account"><span class="account-avatar">Я</span><div><strong>Моё расписание</strong><small><span class="status-dot"/>На этом устройстве</small></div></div></div></aside>
    <main class="main"><header class="page-header"><div><p class="eyebrow">ПРОСТРАНСТВО ДЛЯ ТВОИХ ПЛАНОВ</p><h1>{TITLES[view]}</h1><p class="subtitle">{SUBTITLES[view]}</p></div><div class="header-actions"><span class="mode-chip">{mode === 'demo' ? 'Демо' : 'Локально'}</span><button class="icon-button" aria-label="Настройки" onClick={() => switchView('settings')}><Icon name="settings"/></button><Button kind="primary" icon="plus" onClick={() => view === 'students' ? setDialog({ kind: 'record-choice' }) : view === 'types' ? setDialog({ kind: 'type-editor' }) : newEvent()}>{view === 'students' ? 'Добавить запись' : view === 'types' ? 'Создать тип' : 'Добавить событие'}</Button></div></header>
    {mode === 'demo' && <div class="demo-banner"><Icon name="info"/><span>Деморасписание с вымышленными данными. Пробуй карточки, поля и переносы.</span><button class="text-button" onClick={() => attempt(() => switchMode('personal'))}>Создать своё <Icon name="arrow"/></button></div>}
    {stale && <div class="demo-banner"><span>Расписание изменилось в другой вкладке.</span><Button onClick={() => attempt(() => { if (dialog && !confirm('Закрыть редактор и загрузить изменения из другой вкладки?')) return; setSession({ mode, data: loadData(mode) }); close(); setStale(false); setUndo(null); })}>Обновить данные</Button></div>}
    {body}<footer class="page-footer"><span><span class="status-dot"/>Сохранено в этом браузере</span><span>Московское время · UTC+3</span></footer></main></div>
    {dialog?.kind === 'event-editor' && <EventEditor key={dialog.original?.id || 'new-event'} data={data} {...dialog} onDelete={() => setDeletion({ kind: 'event', value: dialog.original })} onSave={commit} onClose={close} onNewStudent={draft => setDialog({ kind: 'student-editor', returnTo: { ...dialog, draft } })} onNewRecord={(category, draft) => setDialog({ kind: 'record-editor', category, returnTo: { ...dialog, draft } })}/>}
    {dialog?.kind === 'event-details' && <EventDetails data={data} event={dialog.event} onClose={close} onDelete={() => setDeletion({ kind: 'event', value: dialog.event })} onEdit={() => editEvent(dialog.event)} onMove={() => moveDialog(dialog.event)} onRecord={record => setDialog({ kind: 'record-details', record })} onStatus={status => statusEvent(dialog.event, status)} onStudent={student => setDialog({ kind: 'student-details', student })}/>}
    {dialog?.kind === 'student-editor' && <StudentEditor data={data} original={dialog.original} onDelete={() => setDeletion({ kind: 'record', value: dialog.original })} onClose={() => dialog.returnTo ? setDialog(dialog.returnTo) : close()} onSave={(next, message, student) => { const returnTo = dialog.returnTo; commit(next, message); if (returnTo) setDialog({ ...returnTo, draft: { ...returnTo.draft, studentId: student.id, recordId: student.id, title: returnTo.draft.title || student.name, color: student.color } }); }}/>}
    {dialog?.kind === 'student-details' && <StudentDetails data={data} student={dialog.student} onDelete={() => setDeletion({ kind: 'record', value: dialog.student })} onClose={close} onEdit={() => setDialog({ kind: 'student-editor', original: dialog.student })} onEvent={() => newEvent(selectedDate, dialog.student.id)}/>}
    {dialog?.kind === 'move-editor' && <MoveEditor data={data} event={dialog.event} date={dialog.date} onClose={close} onSave={commit} onAdvanced={draft => setDialog({ kind: 'event-editor', original: dialog.event, draft })}/>}
    {dialog?.kind === 'record-choice' && <Modal title="Что добавить?" subtitle="Общие записи можно связывать с разными событиями." onClose={close}><div class="record-choice">{Object.entries(RECORD_KINDS).map(([kind, label]) => <Button key={kind} onClick={() => setDialog({ kind: kind === 'student' ? 'student-editor' : 'record-editor', category: kind })}>{label}</Button>)}<Button onClick={() => setDialog({ kind: 'record-editor', category: 'Моя категория' })}>Своя категория</Button></div></Modal>}
    {dialog?.kind === 'record-editor' && <RecordEditor data={data} original={dialog.original} onDelete={() => setDeletion({ kind: 'record', value: dialog.original })} category={dialog.category} onClose={() => dialog.returnTo ? setDialog(dialog.returnTo) : close()} onSave={(next, message, record) => { const returnTo = dialog.returnTo; commit(next, message); if (returnTo) setDialog({ ...returnTo, draft: { ...returnTo.draft, recordId: record.id, studentId: '', title: returnTo.draft.title || record.name, color: record.color } }); }}/>}
    {dialog?.kind === 'record-details' && <RecordDetails record={dialog.record} onDelete={() => setDeletion({ kind: 'record', value: dialog.record })} onClose={close} onEdit={() => setDialog({ kind: 'record-editor', original: dialog.record })} onEvent={() => newEventForRecord(dialog.record)}/>}
    {dialog?.kind === 'type-editor' && <TypeEditor data={data} original={dialog.original} onDelete={() => setDeletion({ kind: 'type', value: dialog.original })} onClose={close} onSave={commit}/>}
    {deletion && <DeleteDialog data={data} target={deletion} onSave={commit} onClose={() => setDeletion(null)}/>}
    {notice && <div id="notice" class="visible" role="status"><span>{notice.text}</span>{notice.canUndo && undo && <button class="toast-undo" onClick={() => attempt(() => { const restored = persistData(mode, undo, data.revision || 0); setSession({ mode, data: restored }); setUndo(null); close(); notify('Последнее изменение отменено'); })}>Отменить</button>}</div>}
  </>;
}
