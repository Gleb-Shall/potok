import { useEffect, useRef, useState } from 'preact/hooks';
import { Icon } from './components/Icon.jsx';
import { Button, Search, Check, dateLabel, initials, money, dayNames, longDays } from './components/UI.jsx';
import { EventCard } from './components/EventCard.jsx';
import { EventEditor } from './components/EventEditor.jsx';
import { EventDetails } from './components/EventDetails.jsx';
import { StudentEditor, StudentDetails } from './components/StudentEditor.jsx';
import { TypeEditor } from './components/TypeEditor.jsx';
import { addDays, mondayOf, todayISO, weekdayOf, minutesToTime } from './lib/domain.js';
import { getType, getStudent, projectWeek, eventTitle, eventColor, eventMatches, moveEvent, assertNoConflict, normalizeData } from './lib/events.js';
import { loadData, persistData, demoData, exportData } from './lib/storage.js';

const NAV = [['schedule', 'calendar', 'Расписание'], ['students', 'users', 'Ученики'], ['types', 'settings', 'Типы карточек'], ['transfers', 'arrows', 'Переносы']];
const TITLES = { schedule: 'Расписание', students: 'Ученики', types: 'Типы карточек', transfers: 'Переносы', settings: 'Настройки' };
const SUBTITLES = { schedule: 'Пары, уроки и личные планы в одном месте', students: 'Ученик — отдельная карточка, а каждый урок — событие', types: 'Выбери, какие поля нужны твоим событиям', transfers: 'Новое время и вся история изменений', settings: 'Твоё пространство и данные' };

export function App() {
  const today = todayISO();
  const [session, setSession] = useState(() => { const mode = localStorage.getItem('tutor-schedule:mode') === 'personal' ? 'personal' : 'demo'; return { mode, data: loadData(mode) }; });
  const { data, mode } = session;
  const [view, setView] = useState('schedule');
  const [week, setWeek] = useState(mondayOf(today));
  const [selectedDate, setSelectedDate] = useState(today);
  const [query, setQuery] = useState('');
  const [filterType, setFilterType] = useState('');
  const [showGhosts, setShowGhosts] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  const [dialog, setDialog] = useState(null);
  const [notice, setNotice] = useState(null);
  const [undo, setUndo] = useState(null);
  const [stale, setStale] = useState(false);
  const [dropTarget, setDropTarget] = useState('');
  const dragId = useRef(null);
  const importRef = useRef(null);
  const projection = projectWeek(data, week);
  const days = Array.from({ length: 7 }, (_, index) => addDays(week, index));
  const notify = (text, canUndo = false) => setNotice({ text, canUndo });
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(null), 7000); return () => clearTimeout(timer); }, [notice]);
  useEffect(() => {
    const listener = event => { if (event.key === `tutor-schedule:${mode}:v2`) setStale(true); };
    window.addEventListener('storage', listener); return () => window.removeEventListener('storage', listener);
  }, [mode]);

  const commit = (next, message, date) => {
    const saved = persistData(mode, next, data.revision || 0);
    setUndo(data); setSession({ mode, data: saved }); setDialog(null); setStale(false);
    if (date) { setWeek(mondayOf(date)); setSelectedDate(date); }
    notify(message, true);
  };
  const attempt = action => { try { action(); } catch (error) { notify(error.message); } };
  const close = () => setDialog(null);
  const newEvent = (date = selectedDate, studentId = '') => {
    const typeId = studentId ? 'lesson' : filterType || data.types.find(type => !type.archived)?.id;
    if (!typeId) { setView('types'); notify('Сначала создай или верни из архива тип карточки.'); return; }
    const student = getStudent(data, studentId);
    setDialog({ kind: 'event-editor', date, typeId, draft: student ? { studentId, title: student.name, color: student.color, fields: { rate: student.rate } } : undefined });
  };
  const findEvent = id => data.events.find(event => event.id === id) || projection.events.find(event => event.id === id);
  const openEvent = id => { const event = findEvent(id); if (event) setDialog({ kind: 'event-details', event }); };
  const editEvent = (event, date) => setDialog({ kind: 'event-editor', original: event, date });
  const switchView = target => { setView(target); setQuery(''); };
  const switchMode = nextMode => {
    const next = loadData(nextMode); localStorage.setItem('tutor-schedule:mode', nextMode);
    setSession({ mode: nextMode, data: next }); setDialog(null); setUndo(null); setStale(false); setQuery(''); setFilterType('');
    notify(nextMode === 'personal' ? 'Открыто твоё расписание. Демо хранится отдельно.' : 'Открыт отдельный пример расписания.');
  };
  const navigateWeek = delta => { const offset = Math.max(0, days.indexOf(selectedDate)); const next = addDays(week, delta * 7); setWeek(next); setSelectedDate(addDays(next, offset)); };
  const statusEvent = (event, status) => attempt(() => {
    if (status === 'planned' && !event.date) { editEvent(event); return; }
    if (status === 'cancelled' && !confirm('Отменить только это событие? История и остальные повторы сохранятся.')) return;
    const next = status === 'pending' ? moveEvent(event, null, event.start, event.duration) : { ...event, status };
    if (status === 'planned') assertNoConflict(data, next);
    commit({ ...data, events: [...data.events.filter(item => item.id !== next.id), next] }, status === 'pending' ? 'Событие ждёт нового времени' : 'Статус события изменён');
  });
  const drop = (event, target) => {
    event.preventDefault(); setDropTarget('');
    const id = dragId.current || event.dataTransfer.getData('text/plain'); dragId.current = null;
    const item = findEvent(id); if (!item) return;
    if (target === 'pending') statusEvent(item, 'pending'); else editEvent(item, target);
  };
  const dropProps = target => ({ onDragOver: event => { if (dragId.current) { event.preventDefault(); setDropTarget(target); } }, onDragLeave: event => { if (!event.currentTarget.contains(event.relatedTarget)) setDropTarget(''); }, onDrop: event => drop(event, target) });
  const pendingCard = event => <button key={event.id} class="pending-card" onClick={() => editEvent(event)}><span class={`student-avatar color-${eventColor(data, event)}`}>{getType(data, event.typeId).icon}</span><span><strong>{eventTitle(data, event)}</strong><small>Было {dateLabel(event.originalDate || event.anchorDate)} · {minutesToTime(event.originalStart ?? event.start)}</small></span><span class="pending-choose">Выбрать время <Icon name="arrow"/></span></button>;

  function Schedule() {
    const hours = projection.events.reduce((total, event) => total + event.duration, 0) / 60;
    return <><section class="overview"><div class="overview-intro"><span class="section-caption">НА ЭТОЙ НЕДЕЛЕ</span><strong>Твоё время, твои планы<span class="lime-dot">.</span></strong></div>{[['calendar', projection.events.length, 'событий', 'violet-text'], ['clock', `${hours.toLocaleString('ru-RU', { maximumFractionDigits: 1 })} ч`, 'запланировано', 'green-text'], ['arrows', projection.events.filter(event => event.history?.length).length, 'разовых переносов', 'peach-text']].map(([icon, number, label, color]) => <div class="stat" key={label}><span class={`stat-icon ${color}`}><Icon name={icon}/></span><div><strong>{number}</strong><span>{label}</span></div></div>)}</section>
      <section class="schedule-panel" aria-label="Недельное расписание"><div class="calendar-toolbar"><div class="week-navigation"><button class="icon-button" aria-label="Предыдущая неделя" onClick={() => navigateWeek(-1)}><Icon name="left"/></button><h2>{dateLabel(week)} — {dateLabel(addDays(week, 6), { year: 'numeric' })}</h2><button class="icon-button" aria-label="Следующая неделя" onClick={() => navigateWeek(1)}><Icon name="right"/></button><Button kind="small secondary" onClick={() => { setWeek(mondayOf(today)); setSelectedDate(today); }}>Сегодня</Button></div><div class="calendar-filters"><select aria-label="Тип событий" class="type-filter" value={filterType} onChange={event => setFilterType(event.currentTarget.value)}><option value="">Все типы</option>{data.types.map(type => <option key={type.id} value={type.id}>{type.icon} {type.name}</option>)}</select><Search value={query} onChange={setQuery}/></div></div>
      <div class="mobile-days" aria-label="День недели">{days.map(date => <button key={date} class={`mobile-day ${date === selectedDate ? 'selected' : ''}`} onClick={() => setSelectedDate(date)}><span>{dayNames[weekdayOf(date)]}</span><strong>{Number(date.slice(8))}</strong></button>)}</div>
      <div class="calendar-grid">{days.map(date => {
        const events = projection.events.filter(event => event.date === date && eventMatches(data, event, query, filterType));
        const ghosts = showGhosts ? projection.ghosts.filter(event => event.date === date && eventMatches(data, event, query, filterType)) : [];
        const cards = [...events, ...ghosts].sort((a, b) => a.start - b.start);
        return <section key={date} class={`day-column ${date === selectedDate ? 'mobile-selected' : ''} ${date === today ? 'is-today' : ''} ${dropTarget === date ? 'drop-target' : ''}`} {...dropProps(date)} aria-label={`${longDays[weekdayOf(date)]}, ${dateLabel(date)}`}><header class="day-header"><span>{longDays[weekdayOf(date)]}</span><div><strong>{Number(date.slice(8))}</strong>{date === today ? <span class="today-tag">сегодня</span> : <span class="day-count">{events.length ? events.length + ' соб.' : '—'}</span>}</div></header><div class="day-body">{cards.map(event => <EventCard key={`${event.id}:${event.ghost ? 'ghost' : 'live'}`} event={event} data={data} onOpen={openEvent} onDragStart={id => { dragId.current = id; }} onDragEnd={() => { dragId.current = null; setDropTarget(''); }}/>) }{!cards.length && <div class="free-day"><span>{query || filterType ? 'Событий не найдено' : 'Свободный день'}</span><small>{query || filterType ? 'Попробуй другой фильтр' : 'Можно оставить для себя'}</small></div>}<button class="add-slot" onClick={() => newEvent(date)} aria-label={`Добавить событие на ${dateLabel(date)}`}><Icon name="plus"/>Событие</button></div></section>;
      })}</div><div class="calendar-bottom"><span class="drag-hint"><Icon name="arrows"/>Перетащи карточку на другой день, чтобы перенести событие</span><Check checked={showGhosts} onChange={setShowGhosts}>Показывать старое время</Check></div></section>
      <section class={`pending-panel ${dropTarget === 'pending' ? 'drop-target' : ''}`} {...dropProps('pending')}><div class="pending-heading"><span class="pending-symbol"><Icon name="arrows"/></span><div><h2>Ждут нового времени <span class="count-pill">{projection.pending.length}</span></h2><p>События, которые перенесли, но ещё не назначили заново</p></div></div>{projection.pending.length ? <div class="pending-cards">{projection.pending.map(pendingCard)}</div> : <span class="all-good"><Icon name="check"/>Все события на своих местах</span>}</section></>;
  }
  function Students() {
    const filtered = data.students.filter(student => `${student.name} ${student.subject}`.toLocaleLowerCase('ru').includes(query.toLocaleLowerCase('ru')));
    return <section class="students-panel"><div class="section-toolbar"><h2>Твои ученики <span class="count-pill">{data.students.length}</span></h2><Search value={query} onChange={setQuery} placeholder="Имя или направление"/></div><div class="student-grid">{filtered.map(student => <button class="student-tile" key={student.id} onClick={() => setDialog({ kind: 'student-details', student })}><span class={`student-avatar large color-${student.color}`}>{initials(student.name)}</span><strong>{student.name}</strong><span>{student.subject || 'Без направления'}</span><div class="student-tile-footer"><span>{money(student.rate)} <small>/ урок</small></span><span>{data.series.filter(series => !series.archived && series.studentId === student.id).length} расписаний</span></div></button>)}{!filtered.length && <div class="empty-state"><h3>{query ? 'Никого не нашли' : 'Здесь будут твои ученики'}</h3><p>Пары и личные события можно создавать без ученика.</p><Button kind="primary" icon="plus" onClick={() => setDialog({ kind: 'student-editor' })}>Добавить ученика</Button></div>}</div></section>;
  }
  function Types() {
    return <section class="students-panel"><div class="section-toolbar"><h2>Шаблоны твоих событий</h2><Check checked={showArchived} onChange={setShowArchived}>Показать архивные</Check></div><div class="student-grid">{data.types.filter(type => showArchived || !type.archived).map(type => <article key={type.id} class={`type-tile ${type.archived ? 'archived-type' : ''}`}><span class={`student-avatar large color-${type.color}`}>{type.icon}</span><h3>{type.name}{type.archived ? ' · архив' : ''}</h3><p>{type.fields.filter(field => !field.archived).length} доп. полей{type.linkStudent ? ' · связь с учеником' : ''}</p><div class="type-field-tags">{type.fields.filter(field => !field.archived).map(field => <span key={field.id}>{field.label}{field.required ? ' *' : ''}</span>)}</div><div class="type-actions"><Button onClick={() => setDialog({ kind: 'type-editor', original: type })}>Редактировать</Button><button class="text-button" onClick={() => setDialog({ kind: 'type-editor', original: { ...structuredClone(type), id: crypto.randomUUID(), name: `${type.name} (копия)`, archived: false, version: 0 } })}>Копия</button><button class="text-button" onClick={() => attempt(() => commit({ ...data, types: data.types.map(item => item.id === type.id ? { ...item, archived: !item.archived } : item) }, type.archived ? 'Тип возвращён из архива' : 'Тип скрыт для новых событий. Старые события сохранены.'))}>{type.archived ? 'Вернуть' : 'В архив'}</button></div></article>)}</div><p class="quiet-note">Скрытые поля и архивные типы сохраняют данные уже созданных событий. Дата, время, повторение и переносы общие для всех карточек.</p></section>;
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
    return <section class="settings-panel"><article class="settings-card"><span class="section-caption">ХРАНЕНИЕ</span><h2>Локальная версия</h2><p>Данные сохраняются в этом браузере. Firebase, вход в аккаунт и внешний API подключим отдельным этапом.</p><div class="settings-actions"><Button icon="download" onClick={() => exportData(mode, data)}>Скачать резервную копию</Button><Button onClick={() => importRef.current.click()}>Восстановить из копии</Button><input type="file" accept="application/json,.json" hidden ref={importRef} onChange={event => importFile(event.currentTarget.files[0])}/></div></article><article class="settings-card"><span class="section-caption">РАСПИСАНИЕ</span><h2>{mode === 'demo' ? 'Демонстрационный пример' : 'Твои события'}</h2><p>Демо и личные записи хранятся отдельно. Переключение не удаляет данные.</p><Button onClick={() => attempt(() => switchMode(mode === 'demo' ? 'personal' : 'demo'))}>{mode === 'demo' ? 'Перейти к своему расписанию' : 'Открыть демо'}</Button>{mode === 'demo' && <button class="text-button" onClick={() => attempt(() => { if (confirm('Восстановить вымышленный пример? Личное расписание не изменится.')) commit(demoData(), 'Демо восстановлено'); })}>Восстановить пример</button>}</article><article class="settings-card"><span class="section-caption">ПОВТОРЕНИЯ И ПЕРЕНОСЫ</span><h2>Одно событие или всё расписание</h2><p>В редакторе повторяющегося события выбери, изменить только этот экземпляр или его и последующие. Разовый перенос сохраняет обычное время других недель. История остаётся внутри карточки.</p></article><article class="settings-card"><span class="section-caption">СВОИ КАРТОЧКИ</span><h2>Поля под твои задачи</h2><p>В «Типах карточек» можно добавлять поля, менять порядок, обязательность и видимость. Использованные поля скрываются с сохранением значений.</p><Button onClick={() => switchView('types')}>Открыть конструктор</Button></article></section>;
  }

  const body = view === 'schedule' ? Schedule() : view === 'students' ? Students() : view === 'types' ? Types() : view === 'transfers' ? Transfers() : Settings();
  return <><div class="layout"><aside class="sidebar"><a class="brand" href="#" onClick={event => { event.preventDefault(); switchView('schedule'); }}><span class="brand-mark">у</span><span>уроки<span class="brand-dot">.</span></span></a><div class="workspace-label">ЛИЧНОЕ ПРОСТРАНСТВО</div><nav aria-label="Разделы">{NAV.map(([id, icon, label]) => <button key={id} class={`nav-item ${view === id ? 'active' : ''}`} aria-current={view === id ? 'page' : undefined} onClick={() => switchView(id)}><Icon name={icon}/><span>{label}</span>{id === 'transfers' && projection.pending.length > 0 && <span class="nav-count amber">{projection.pending.length}</span>}</button>)}</nav><div class="sidebar-note"><span class="tiny-spark">✳</span><p>Учёба, работа и жизнь.<br/>Всё в твоём ритме.</p></div><div class="sidebar-bottom"><button class={`nav-item ${view === 'settings' ? 'active' : ''}`} onClick={() => switchView('settings')}><Icon name="settings"/><span>Настройки</span></button><div class="account"><span class="account-avatar">Я</span><div><strong>Моё расписание</strong><small><span class="status-dot"/>На этом устройстве</small></div></div></div></aside>
    <main class="main"><header class="page-header"><div><p class="eyebrow">ТВОЁ ВРЕМЯ — ТВОИ ПРАВИЛА</p><h1>{TITLES[view]}</h1><p class="subtitle">{SUBTITLES[view]}</p></div><div class="header-actions"><span class="mode-chip">{mode === 'demo' ? 'Демо' : 'Локально'}</span><button class="icon-button" aria-label="Настройки" onClick={() => switchView('settings')}><Icon name="settings"/></button><Button kind="primary" icon="plus" onClick={() => view === 'students' ? setDialog({ kind: 'student-editor' }) : view === 'types' ? setDialog({ kind: 'type-editor' }) : newEvent()}>{view === 'students' ? 'Добавить ученика' : view === 'types' ? 'Создать тип' : 'Добавить событие'}</Button></div></header>
    {mode === 'demo' && <div class="demo-banner"><Icon name="info"/><span>Деморасписание с вымышленными данными. Пробуй карточки, поля и переносы.</span><button class="text-button" onClick={() => attempt(() => switchMode('personal'))}>Создать своё <Icon name="arrow"/></button></div>}
    {stale && <div class="demo-banner"><span>Расписание изменилось в другой вкладке.</span><Button onClick={() => attempt(() => { if (dialog && !confirm('Закрыть редактор и загрузить изменения из другой вкладки?')) return; setSession({ mode, data: loadData(mode) }); close(); setStale(false); setUndo(null); })}>Обновить данные</Button></div>}
    {body}<footer class="page-footer"><span><span class="status-dot"/>Сохранено в этом браузере</span><span>Московское время · UTC+3</span></footer></main></div>
    {dialog?.kind === 'event-editor' && <EventEditor key={dialog.original?.id || 'new-event'} data={data} {...dialog} onSave={commit} onClose={close} onNewStudent={draft => setDialog({ kind: 'student-editor', returnTo: { ...dialog, draft } })}/>}
    {dialog?.kind === 'event-details' && <EventDetails data={data} event={dialog.event} onClose={close} onEdit={() => editEvent(dialog.event)} onStatus={status => statusEvent(dialog.event, status)} onStudent={student => setDialog({ kind: 'student-details', student })}/>}
    {dialog?.kind === 'student-editor' && <StudentEditor data={data} original={dialog.original} onClose={close} onSave={(next, message, student) => { const returnTo = dialog.returnTo; commit(next, message); if (returnTo) setDialog({ ...returnTo, draft: { ...returnTo.draft, studentId: student.id, title: returnTo.draft.title || student.name, color: student.color } }); }}/>} 
    {dialog?.kind === 'student-details' && <StudentDetails data={data} student={dialog.student} onClose={close} onEdit={() => setDialog({ kind: 'student-editor', original: dialog.student })} onEvent={() => newEvent(selectedDate, dialog.student.id)}/>}
    {dialog?.kind === 'type-editor' && <TypeEditor data={data} original={dialog.original} onClose={close} onSave={commit}/>}
    {notice && <div id="notice" class="visible" role="status"><span>{notice.text}</span>{notice.canUndo && undo && <button class="toast-undo" onClick={() => attempt(() => { const restored = persistData(mode, undo, data.revision || 0); setSession({ mode, data: restored }); setUndo(null); close(); notify('Последнее изменение отменено'); })}>Отменить</button>}</div>}
  </>;
}
