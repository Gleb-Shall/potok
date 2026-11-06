import { CloudSettings } from './components/CloudSettings.jsx';
import { useWorkspaceTheme } from './theme/ThemeProvider.jsx';
import { getFirebaseConfig } from './lib/cloud-config.js';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { lazy, Suspense } from 'preact/compat';
import { AppearanceSettings } from './components/AppearanceSettings.jsx';
import { RecordsDirectory } from './components/RecordsDirectory.jsx';
import { TemplateBrowser } from './components/TemplateBrowser.jsx';
import { MarkerPaint } from './components/MarkerPaint.jsx';
import { Sidebar } from './components/Sidebar.jsx';
import { Brand } from './components/Brand.jsx';
import { WorkspaceEntry } from './components/WorkspaceEntry.jsx';
import { MobileNav } from './components/MobileNav.jsx';
import { Icon } from './components/Icon.jsx';
import { Button, Search, Check, dateLabel, initials, dayNames, longDays } from './components/UI.jsx';
import { HistoryView } from './components/HistoryView.jsx';
import { TransfersView } from './components/TransfersView.jsx';
import { PendingEventCard, PendingQueue } from './components/PendingEvents.jsx';
import { StopSeriesDialog } from './components/StopSeriesDialog.jsx';
import { DEFAULT_STATE_EFFECTS } from './lib/state-appearance.js';
import { setEventStatus } from './lib/event-history.js';
import { EventCard } from './components/EventCard.jsx';
import { WeekCalendar } from './components/WeekCalendar.jsx';
import { HOUR_HEIGHT, readTimeTarget, timelineDropTarget } from './lib/week-layout.js';
import { EventEditor } from './components/EventEditor.jsx';
import { ReminderDialog } from './components/ReminderDialog.jsx';
import { SyncStatus } from './components/SyncStatus.jsx';
import { EventDetails } from './components/EventDetails.jsx';
import { StudentEditor, StudentDetails } from './components/StudentEditor.jsx';
import { TypeEditor } from './components/TypeEditor.jsx';
import { DeleteDialog } from './components/DeleteDialog.jsx';
import { MoveEditor } from './components/MoveEditor.jsx';
import { RecordEditor, RecordDetails } from './components/RecordEditor.jsx';
import { Modal } from './components/UI.jsx';
const MapView = lazy(() => import('./components/MapView.jsx'));
import { addDays, monthStart, todayISO, weekdayOf, minutesToTime } from './lib/domain.js';
import { getStudent, projectWeek, eventTitle, eventColor, eventMatches, moveEvent, saveMove, restoreMove, isEventMoved, assertNoConflict, normalizeData, calendarRange, recordKind, RECORD_KINDS } from './lib/events.js';
import { loadData, demoData, exportData } from './lib/storage.js';
import { TouchMovePicker, PressDragGhost } from './components/TouchMovePicker.jsx';
import { useCalendarSwipe } from './hooks/useCalendarSwipe.js';
import { CALENDAR_BUFFER_DAYS } from './hooks/useCalendarPan.js';
import { usePressDrag, touchDropTarget } from './hooks/usePressDrag.js';
import { useWorkspace } from './hooks/useWorkspace.js';
import { activeReminders, saveReminder, removeReminder, reminderMessage } from './lib/reminders.js';
import { PUSH_READY, enablePushForUser } from './lib/push-notifications.js';
import { explainFirebaseError } from './lib/firebase-client.js';

const TITLES = { appearance:'Внешний вид', schedule: 'Расписание', students: 'Записи', types: 'Шаблоны', transfers: 'Переносы', history: 'История событий', settings: 'Настройки' };
const eventCount = count => `${count} ${{one:'событие',few:'события',many:'событий',other:'события'}[new Intl.PluralRules('ru').select(count)]}`;

export function App({ initialMode, demoOnly = false, requireAccount = false, onHome, onPersonal, onDemo } = {}) {
  useWorkspaceTheme();
  const [now, setNow] = useState(() => Date.now());
  const today = todayISO(new Date(now));
  useEffect(() => {
    const update = () => setNow(Date.now());
    const timer = setInterval(update, 60000);
    document.addEventListener('visibilitychange', update);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', update); };
  }, []);
  const [dialog, setDialog] = useState(null);
  const [deletion, setDeletion] = useState(null);
  const [movePicker, setMovePicker] = useState(null);
  const [moveHover, setMoveHover] = useState(null);
  const layoutRef = useRef(null);
  const [touchMoving, setTouchMoving] = useState(false);
  const workspace = useWorkspace(Boolean(dialog || deletion || touchMoving || movePicker), { initialMode, demoOnly });
  const { data, mode } = workspace.session;
  const { account, stale } = workspace;
  const cloudConfigured = Boolean(getFirebaseConfig());
  const signIn = () => cloudConfigured ? workspace.signIn() : switchView('settings');
  const [view, setView] = useState('schedule');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('potok:sidebar-collapsed');
    return saved === null ? true : saved === 'true';
  });
  const toggleSidebar = () => setSidebarCollapsed(previous => {
    const next = !previous;
    localStorage.setItem('potok:sidebar-collapsed', String(next));
    return next;
  });
  const [week, setWeek] = useState(today);
  const [rangeView, setRangeView] = useState('week');
  const [weekStart, setWeekStart] = useState(null);
  const [calendarFocus, setCalendarFocus] = useState(0);
  const scheduleRef = useRef(null);
  const [mapView, setMapView] = useState(false);
  const [weekLayout,setWeekLayout]=useState(()=>localStorage.getItem('potok:week-layout')==='board'?'board':'timeline');
  const [visibleHours,setVisibleHours]=useState([0,24]);
  const [mobileDays,setMobileDays]=useState(3);
  const [pendingOpen,setPendingOpen]=useState(false);
  const timeline=rangeView==='day' || rangeView==='week' && weekLayout==='timeline';
  const [compact, setCompact] = useState(true);
  const [cardOverrides, setCardOverrides] = useState({});
  const [recordFilter, setRecordFilter] = useState('');
  const [selectedDate, setSelectedDate] = useState(today);
  const [query, setQuery] = useState('');
  const [filterType, setFilterType] = useState('');
  const [showGhosts, setShowGhosts] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  const [notice, setNotice] = useState(null);
  const [undo, setUndo] = useState(null);
  const [dropTarget, setDropTarget] = useState('');
  const dragId = useRef(null);
  const grabOffset=useRef(0);
  const rememberGrab=(node,point)=>{grabOffset.current=timeline && node?.closest('.week-event') && Number.isFinite(point?.y)?Math.max(0,(point.y-node.getBoundingClientRect().top)/HOUR_HEIGHT*60):0;};
  const [draggingId, setDraggingId] = useState('');
  const endDrag = () => { dragId.current = null; setDraggingId(''); setDropTarget(''); setMovePicker(null); setMoveHover(null); };
  const returnEvent = item => attempt(() => { endDrag(); commit(removeReminder(restoreMove(data, item), item.id), 'Перенос отменён — событие вернулось на исходное время', item.originalDate || item.anchorDate); });
  const importRef = useRef(null);
  const range = useMemo(()=>calendarRange(week,rangeView,weekStart),[week,rangeView,weekStart]);
  const projection = useMemo(()=>projectWeek(data,range.start,range.count),[data,range.start,range.count]);
  const days = useMemo(()=>Array.from({length:range.count},(_,index)=>addDays(range.start,index)),[range.start,range.count]);
  const stripProjection = useMemo(()=>timeline ? projectWeek(data,addDays(range.start,-CALENDAR_BUFFER_DAYS),range.count+2*CALENDAR_BUFFER_DAYS) : projection,[data,timeline,range.start,range.count,projection]);
  const stripEvents = useMemo(()=>stripProjection.events.filter(event=>eventMatches(data,event,query,filterType)),[data,stripProjection,query,filterType]);
  const stripGhosts = useMemo(()=>showGhosts ? stripProjection.ghosts.filter(event=>eventMatches(data,event,query,filterType)) : [],[data,stripProjection,query,filterType,showGhosts]);
  const visibleEvents = useMemo(()=>projection.events.filter(event=>eventMatches(data,event,query,filterType)),[data,projection,query,filterType]);
  const notify = (text, canUndo = false) => setNotice({ text, canUndo });
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(null), 7000); return () => clearTimeout(timer); }, [notice]);
  useEffect(() => { setDialog(null); setDeletion(null); setUndo(null); setNotice(null); setQuery(''); setFilterType(''); setWeek(todayISO()); setSelectedDate(todayISO()); setRangeView('week'); setWeekStart(null); setView('schedule'); setMovePicker(null); }, [account.user?.uid]);

  const commit = (next, message, date) => {
    const finish = saved => {
      if (filterType && !next.types.some(type => type.id === filterType)) setFilterType('');
      setDeletion(null); setUndo({ data, revision: saved.revision, mode }); setDialog(null);
      if (date) { if (date < range.start || date > range.end) { setWeek(date); setWeekStart(null); } setSelectedDate(date); }
      notify(message, true);
      return true;
    };
    const result = workspace.save(next);
    if (result?.then) return result.then(finish).catch(error => { notify(explainFirebaseError(error)); return false; });
    return finish(result);
  };
  const attempt = action => { try { const result = action(); if (result?.catch) result.catch(error => notify(explainFirebaseError(error))); } catch (error) { notify(explainFirebaseError(error)); } };
  const close = () => setDialog(null);
  const newEvent = (date = selectedDate, studentId = '', start) => {
    const typeId = studentId ? (data.types.find(type => !type.archived && recordKind(type) === 'student') || data.types.find(type => !type.archived && recordKind(type) === 'any'))?.id : filterType || data.types.find(type => !type.archived && type.id === 'personal')?.id || data.types.find(type => !type.archived)?.id;
    if (!typeId) { setView('types'); notify('Сначала создай или верни из архива тип карточки.'); return; }
    const student = getStudent(data, studentId);
    setDialog({ kind: 'event-editor', date, typeId, draft: student ? { studentId, recordId: studentId, title: student.name, color: student.color, fields: { rate: student.rate }, ...(start===undefined?{}:{start:minutesToTime(start)}) } : start===undefined?undefined:{start:minutesToTime(start)} });
  };
  const findEvent = id => data.events.find(event => event.id === id) || stripProjection.events.find(event => event.id === id);
  const openEvent = id => { const event = findEvent(id); if (event) setDialog({ kind: 'event-details', event }); };
  useEffect(() => {
    if (requireAccount && (!account.user || !account.hasData)) return;
    const params = new URLSearchParams(window.location.search);
    const eventId = params.get('event');
    if (!eventId || params.get('uid') && params.get('uid') !== account.user?.uid) return;
    const event = data.events.find(item => item.id === eventId);
    if (!event) return;
    setDialog({kind:'event-details',event});
    params.delete('event'); params.delete('uid');
    history.replaceState(null,'',window.location.pathname + (params.size ? '?' + params.toString() : '') + window.location.hash);
  }, [account.user?.uid, account.hasData, data.revision]);
  const editEvent = (event, date) => setDialog({ kind: 'event-editor', original: event, date });
  const newEventForRecord = record => {
    if (record.kind === 'student') { newEvent(selectedDate, record.id); return; }
    const type = data.types.find(type => !type.archived && recordKind(type) === record.kind) || data.types.find(type => !type.archived && recordKind(type) === 'any');
    if (!type) { setView('types'); close(); notify('В конструкторе выбери для типа связь с этой категорией записей.'); return; }
    setDialog({ kind: 'event-editor', date: selectedDate, typeId: type.id, draft: { recordId: record.id, title: record.name, color: record.color } });
  };
  const switchView = target => { setView(target); setQuery(''); setSidebarCollapsed(true); if (target === 'schedule') goToday(); };
  const switchMode = nextMode => {
    if (nextMode === 'personal' && onPersonal) { onPersonal(); return; }
    if (nextMode === 'demo' && onDemo) { onDemo(); return; }
    workspace.switchMode(nextMode);
    setDialog(null); setDeletion(null); setUndo(null); setQuery(''); setFilterType('');
    notify(nextMode === 'personal' ? 'Открыто твоё расписание. Демо хранится отдельно.' : 'Открыт отдельный пример расписания.');
  };
  const goToday = () => {
    setWeek(today); setSelectedDate(today); setWeekStart(null); setCalendarFocus(value=>value+1);
  };
  const selectRange = nextView => {
    if (nextView === rangeView) goToday();
    else { setRangeView(nextView); setWeek(selectedDate); setWeekStart(null); setCalendarFocus(value=>value+1); }
  };
  const navigateWeek = delta => {
    if (rangeView === 'month') {
      const date = monthStart(week, delta);
      setWeek(date); setSelectedDate(date);
    } else {
      const offset = Math.max(0, days.indexOf(selectedDate));
      const next = addDays(range.start, delta * range.count);
      setWeek(next); setSelectedDate(addDays(next, offset));
      if (rangeView === 'week') setWeekStart(next);
    }
  };
  const shiftDay = delta => {
    const date = addDays(selectedDate, delta);
    setSelectedDate(date); setWeek(date);
    if (rangeView === 'week') setWeekStart(addDays(range.start, delta));
  };
  const selectCalendarDate = date => {
    setSelectedDate(date);
    if (date < range.start || date > range.end) { setWeek(date); setWeekStart(rangeView === 'week' ? date : null); }
  };
  const moveDialog = (event, date) => setDialog({ kind: 'move-editor', event, date });
  const openMovePicker = event => { setDialog(null); setMovePicker({ event, native: false }); };
  const placeEvent = (event,target,gestureMode='board') => {
    if(target==='pending') {statusEvent(event,'pending');return;}
    const parsed=readTimeTarget(target);
    if(!parsed)return;
    const {date}=parsed,start=parsed.start??event.start;
    if(event.date===date && event.start===start)return;
    if(isEventMoved(event) && date===(event.originalDate||event.anchorDate) && (parsed.start===null || start===(event.originalStart??event.start))) returnEvent(event);
    else if(gestureMode==='board') attempt(()=>commit(saveMove(data,event,date,start),'Событие перенесено',date));
    else moveDialog(event,date);
  };
  const dropTouchEvent = (event,target,gestureMode) => placeEvent(event,target,gestureMode||'calendar');
  const touch = usePressDrag({ root: layoutRef, enabled: view === 'schedule' && !dialog && !deletion && !movePicker && !account.saving && (!requireAccount || account.ready), selector: '[data-event-id]', quickDrag:true,
    getItem: (node,point) => { rememberGrab(node,point);const event = [...stripProjection.events,...projection.pending].find(item => item.id === node.dataset.eventId); return event?.status !== 'done' ? event : null; },
    hitTest: (point,mode) => mode === 'board' ? (timeline && timelineDropTarget(point,findEvent(dragId.current)?.duration,grabOffset.current) || touchDropTarget(point,'[data-board-drop]','data-board-drop')) : touchDropTarget(point, '[data-press-drop]', 'data-press-drop') || touchDropTarget(point, '[data-press-page]', 'data-press-page') || touchDropTarget(point, '[data-press-action]', 'data-press-action'),
    onDrop: dropTouchEvent, onHover:(date,mode)=>{if(mode==='board')setDropTarget(date||'');}, onActiveChange:(active,mode,item)=>{setTouchMoving(active);if(mode==='board'){dragId.current=item.id;setDraggingId(item.id);}if(!active){dragId.current=null;setDraggingId('');setDropTarget('');}},
  });
  const cancelMovePicker = () => { touch.cancel(); endDrag(); };
  const picker = movePicker ? { drag: { item: movePicker.event }, hover: moveHover, cancel: cancelMovePicker } : touch.drag?.mode === 'board' ? {...touch,drag:null} : touch;
  useCalendarSwipe(scheduleRef, shiftDay, view === 'schedule' && !timeline && rangeView !== 'month' && !mapView && !dialog && !deletion && !picker.drag && !draggingId, rangeView);
  const statusEvent = (event, status) => attempt(() => {
    if (status === 'planned' && !event.date) { moveDialog(event); return; }
    if (status === 'cancelled' && !confirm('Отменить только это событие? История и остальные повторы сохранятся.')) return;
    const next = status === 'pending' ? moveEvent(event, null, event.start, event.duration) : event;
    if (status === 'planned') assertNoConflict(data, next);
    commit(setEventStatus(data, next, status, now), status === 'pending' ? 'Событие ждёт нового времени' : 'Статус события изменён');
  });
  const drop = (event, target) => {
    event.preventDefault();
    const id = dragId.current;
    endDrag();
    const item = findEvent(id); if (!item) return;
    placeEvent(item,target);
  };
  const dropProps = target => ({ onDragOver: event => { if (dragId.current) { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; if (dropTarget !== target) setDropTarget(target); } }, onDragLeave: event => { if (!event.currentTarget.contains(event.relatedTarget)) setDropTarget(''); }, onDrop: event => drop(event, target) });
  const pendingCard = event => <PendingEventCard key={event.id} event={event} data={data} onOpen={openEvent} onRemind={item=>setDialog({kind:'reminder',event:item})} onMove={moveDialog} onRestore={returnEvent} onDragStart={(item,input)=>{dragId.current=item.id;setDraggingId(item.id);input.dataTransfer.setData('text/plain',item.id);input.dataTransfer.effectAllowed='move';}} onDragEnd={endDrag}/>;


  function Schedule() {
    const filtered = visibleEvents;
    const hours = filtered.reduce((total, event) => total + event.duration, 0) / 60;
    return <><section class={`schedule-panel ${timeline?'is-timeline':''}`} aria-label="Расписание событий" data-ui ref={scheduleRef}>
      <div class="calendar-options-bar">{rangeView==='week' && <div class="week-layout-switch" role="group" aria-label="Вид недели">{[['timeline','По времени'],['board','Доска']].map(([id,label])=><button type="button" key={id} aria-pressed={weekLayout===id} onClick={()=>{setWeekLayout(id);localStorage.setItem('potok:week-layout',id);}}>{label}</button>)}</div>}{filtered.length > 0 && <span class="period-count">{eventCount(filtered.length)} · {hours.toLocaleString('ru-RU', { maximumFractionDigits: 1 })} ч</span>}{(query || filterType) && <button type="button" class="text-button filter-reset" onClick={() => { setQuery(''); setFilterType(''); }}>Сбросить фильтры ×</button>}{projection.pending.length > 0 && <button type="button" class="pending-shortcut" onClick={() => setPendingOpen(!pendingOpen)} aria-expanded={pendingOpen} aria-controls="schedule-pending"><Icon name="clock"/>Ждут переноса <span>{projection.pending.length}</span></button>}<details class="calendar-options"><summary><Icon name="sliders"/>Вид и фильтры{(query || filterType) && <span class="filter-dot"/>}</summary><div class="schedule-controls"><div class="calendar-filters"><Search value={query} onChange={setQuery}/><select aria-label="Тип событий" class="type-filter" value={filterType} onChange={event => setFilterType(event.currentTarget.value)}><option value="">Все типы</option>{data.types.map(type => <option key={type.id} value={type.id}>{type.name}</option>)}</select></div><div class="schedule-view-controls">{rangeView === 'week' && <div class="week-mobile-controls"><span>Дней на экране</span><div role="group" aria-label="Дней на экране">{[1,3].map(count=><button type="button" key={count} aria-pressed={mobileDays===count} onClick={()=>setMobileDays(count)}>{count}</button>)}</div></div>}<Button icon={mapView ? 'calendar' : 'pin'} onClick={() => setMapView(!mapView)}>{mapView ? 'Расписание' : 'На карте'}</Button>{!mapView && !timeline && <Button onClick={() => { setCompact(!compact); setCardOverrides({}); }}>{compact ? 'Раскрыть карточки' : 'Свернуть карточки'}</Button>}{timeline && <div class="week-hours"><label>Часы<select aria-label="Начало видимых часов" value={visibleHours[0]} onChange={input=>setVisibleHours([Number(input.currentTarget.value),visibleHours[1]])}>{[0,5,6,7,8,9,10,12].filter(hour=>hour<visibleHours[1]).map(hour=><option key={hour} value={hour}>{minutesToTime(hour*60)}</option>)}</select><span>—</span><select aria-label="Конец видимых часов" value={visibleHours[1]} onChange={input=>setVisibleHours([visibleHours[0],Number(input.currentTarget.value)])}>{[16,18,20,22,23,24].filter(hour=>hour>visibleHours[0]).map(hour=><option key={hour} value={hour}>{hour===24?'24:00':minutesToTime(hour*60)}</option>)}</select></label><small>Диапазон расширяется, если событие выходит за его пределы.</small></div>}<Check checked={showGhosts} onChange={setShowGhosts}>Показывать старое время</Check></div></div></details></div>
      {mapView ? <Suspense fallback={<p class="empty-copy">Загружаю карту…</p>}><MapView events={filtered} data={data} onOpen={openEvent}/></Suspense> : timeline ? <><WeekCalendar days={days} events={stripEvents} ghosts={stripGhosts} focusKey={calendarFocus} onShift={shiftDay} panEnabled={!dialog && !deletion && !picker.drag && !draggingId} data={data} now={now} today={today} selectedDate={selectedDate} onSelectDate={selectCalendarDate} onOpen={openEvent} onCreate={(date,start)=>newEvent(date,'',start)} onDragStart={(id,input)=>{rememberGrab(input.currentTarget,{y:input.clientY});dragId.current=id;setDraggingId(id);}} onDragEnd={endDrag} onDrop={drop} onHover={setDropTarget} draggingId={draggingId} draggedEvent={findEvent(draggingId)} dropTarget={dropTarget} grabOffset={grabOffset.current} fromHour={visibleHours[0]} toHour={visibleHours[1]} mobileDays={rangeView === 'day' ? 1 : mobileDays}/></> : <>
      <div class={`mobile-days ${rangeView === 'month' ? 'is-month-picker' : ''}`} aria-label="Дни периода">{days.map(date => <button key={date} data-board-drop={date} aria-pressed={date === selectedDate} class={`mobile-day ${date === selectedDate ? 'selected' : ''} ${dropTarget === date ? 'board-drop-target' : ''} ${date === today ? 'is-current-day' : date < today ? 'is-past-picker-day' : ''} ${rangeView === 'month' && date.slice(0,7) !== week.slice(0,7) ? 'outside-picker-month' : ''}`} onClick={() => setSelectedDate(date)} data-state-effect={DEFAULT_STATE_EFFECTS.pastDay}>{date < today && <MarkerPaint/>}<span>{dayNames[weekdayOf(date)]}</span><strong>{Number(date.slice(8))}</strong><i class={filtered.some(event=>event.date===date)?'has-events':''}/></button>)}</div>
      <div class={`calendar-scroll range-${rangeView}`}><div class={`calendar-grid calendar-${rangeView}`}>{days.map(date => {
        const events = filtered.filter(event => event.date === date);
        const ghosts = showGhosts ? projection.ghosts.filter(event => event.date === date && eventMatches(data, event, query, filterType)) : [];
        const cards = [...events, ...ghosts].sort((a, b) => a.start - b.start);
        return <section key={date} data-board-drop={date} class={`day-column ${date === selectedDate ? 'mobile-selected' : ''} ${date === today ? 'is-today' : date < today ? 'is-past-day' : ''} ${rangeView === 'month' && date.slice(0, 7) !== week.slice(0, 7) ? 'outside-month' : ''} ${dropTarget === date ? 'drop-target' : ''}`} {...dropProps(date)} aria-label={`${longDays[weekdayOf(date)]}, ${dateLabel(date)}`}>
          <header class="day-header" data-day-state={date < today ? 'past' : date === today ? 'today' : 'future'} data-state-effect={DEFAULT_STATE_EFFECTS.pastDay} title={date < today ? 'Этот день прошёл' : undefined}>{date < today && <MarkerPaint/>}<span>{dayNames[weekdayOf(date)]}</span><div><strong>{Number(date.slice(8))}</strong>{date === today ? <span class="today-tag">сегодня</span> : null}</div></header>
          <div class="day-body">{draggingId && dropTarget === date && <div class="drop-preview" aria-live="polite"><Icon name="arrows"/><strong>{findEvent(draggingId)?.date === date ? 'Оставить на месте' : isEventMoved(findEvent(draggingId) || {}) && (findEvent(draggingId)?.originalDate || findEvent(draggingId)?.anchorDate) === date ? 'Отпустить — отменить перенос' : 'Отпустить — выбрать время'}</strong></div>}{cards.map(event => <EventCard key={`${event.id}:${event.ghost ? 'ghost' : 'live'}`} event={event} data={data} now={now} onOpen={openEvent} onDelete={event => setDeletion({ kind: 'event', value: event })} expanded={cardOverrides[event.id] ?? !compact} onMove={openMovePicker} onDefer={event => statusEvent(event, 'pending')} onToggle={id => setCardOverrides(previous => ({ ...previous, [id]: !(previous[id] ?? !compact) }))} isDragging={draggingId === event.id && !event.ghost} canRestore={event.ghost && draggingId === event.id} onRestoreDrop={() => returnEvent(findEvent(event.id))} onDragStart={id => { const event = findEvent(id); if (!event) return; dragId.current = id; setDraggingId(id); }} onDragEnd={endDrag}/>) }
          {!cards.length && <div class="free-day"><span>{query || filterType ? 'Нет событий' : 'Свободно'}</span></div>}<button class="add-slot" onClick={() => newEvent(date)} aria-label={`Добавить событие на ${dateLabel(date)}`}><Icon name="plus"/>Событие</button></div>
        </section>;
      })}</div></div></>}
      </section><PendingQueue events={projection.pending} hidden={!pendingOpen && !draggingId} target={dropTarget} dropProps={dropProps('pending')} renderEvent={pendingCard} onClose={()=>setPendingOpen(false)}/></>;

  }
  function Students() {
    return <RecordsDirectory data={data} today={today} query={query} onQuery={setQuery} filter={recordFilter} onFilter={setRecordFilter} onOpen={record=>setDialog(record.kind==='student'?{kind:'student-details',student:record}:{kind:'record-details',record})} onAdd={()=>setDialog({kind:'record-choice'})}/>;
  }
  function Types() {
    return <TemplateBrowser data={data} showArchived={showArchived} onArchived={setShowArchived} onEdit={type=>setDialog({kind:'type-editor',original:type})} onCopy={type=>setDialog({kind:'type-editor',original:{...structuredClone(type),id:crypto.randomUUID(),name:`${type.name} (копия)`,archived:false,version:0}})} onDelete={type=>setDeletion({kind:'type',value:type})} onArchive={type=>attempt(()=>commit({...data,types:data.types.map(item=>item.id===type.id?{...item,archived:!item.archived}:item)},type.archived?'Шаблон возвращён из архива':'Шаблон в архиве. Старые события сохранены.'))} onAdd={()=>setDialog({kind:'type-editor'})}/>;
  }
  async function importFile(file) {
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()); const restored = normalizeData(parsed.data || parsed);
      if (!confirm('Заменить текущее расписание данными из копии? Последнее действие можно будет отменить.')) return;
      await commit(restored, 'Резервная копия восстановлена');
    } catch (error) { notify(`Не удалось восстановить копию: ${error.message}`); }
    finally { if (importRef.current) importRef.current.value = ''; }
  }
  function Settings() {
    return <section class="settings-panel"><CloudSettings signedIn={Boolean(account.user)}/><article class="settings-card"><h2>Внешний вид</h2><p>Качество анимаций и чёткость изображения.</p><Button onClick={() => switchView('appearance')}>Настроить оформление</Button></article><article class="settings-card"><span class="section-caption">АККАУНТ И ХРАНЕНИЕ</span><h2>{account.user ? account.user.displayName || 'Твой аккаунт' : 'Твои планы на любом устройстве'}</h2><p>{account.user ? `${account.user.email} · Личное расписание сохраняется в аккаунте Google.` : 'Войди через Google, чтобы открыть одно расписание на телефоне и компьютере. Пока личные записи сохраняются в этом браузере.'}</p><div class="settings-actions">{account.user ? <><Button onClick={() => attempt(() => workspace.signOut())} disabled={account.saving}>Выйти из аккаунта</Button><Button onClick={() => { if (confirm('Заменить расписание в аккаунте личными данными из этого браузера? Текущую облачную версию можно заранее скачать.')) attempt(() => commit(loadData('personal'), 'Локальные записи перенесены в аккаунт')); }} disabled={mode !== 'cloud' || !account.ready || account.saving}>Перенести локальные записи в аккаунт</Button></> : <Button kind="primary" disabled={account.loading} onClick={demoOnly && onPersonal ? onPersonal : signIn}>{account.loading ? 'Подключение…' : 'Войти через Google'}</Button>}</div><div class="settings-actions"><Button icon="download" onClick={() => exportData(mode, data)}>Скачать резервную копию</Button><Button onClick={() => importRef.current.click()}>Восстановить из копии</Button><input type="file" accept="application/json,.json" hidden ref={importRef} onChange={event => importFile(event.currentTarget.files[0])}/></div></article>{!requireAccount && <article class="settings-card"><span class="section-caption">РАСПИСАНИЕ</span><h2>{mode === 'demo' ? 'Демонстрационный пример' : 'Твои события'}</h2><p>Демо и личные записи хранятся отдельно. Переключение не удаляет данные.</p><Button onClick={() => attempt(() => switchMode(mode === 'demo' ? 'personal' : 'demo'))}>{mode === 'demo' ? 'Перейти к своему расписанию' : 'Открыть демо'}</Button>{mode === 'demo' && <button class="text-button" onClick={() => attempt(() => { if (confirm('Восстановить вымышленный пример? Личное расписание не изменится.')) commit(demoData(), 'Демо восстановлено'); })}>Восстановить пример</button>}</article>}<article class="settings-card"><span class="section-caption">ПОВТОРЕНИЯ И ПЕРЕНОСЫ</span><h2>Одно событие или всё расписание</h2><p>В редакторе повторяющегося события выбери, изменить только этот экземпляр или его и последующие. Разовый перенос сохраняет обычное время других недель. История остаётся внутри карточки.</p></article><article class="settings-card"><span class="section-caption">СВОИ КАРТОЧКИ</span><h2>Поля под твои события</h2><p>В «Шаблонах» можно добавлять поля, менять порядок, обязательность и видимость. Использованные поля скрываются с сохранением значений.</p><Button onClick={() => switchView('types')}>Открыть конструктор</Button></article></section>;
  }

  if (requireAccount && (!account.authResolved || (account.user && !account.hasData)) && !account.error) return <div class="planner-loading" role="status"><span class="loading-orbit"/><p>Открываем твоё пространство…</p></div>;
  if (requireAccount && (!account.user || !account.hasData)) return <WorkspaceEntry account={account} onSignIn={workspace.signIn} onRetry={workspace.reconnect} onSignOut={()=>attempt(workspace.signOut)} onHome={onHome} onDemo={onDemo}/>;
  const body = view === 'schedule' ? Schedule() : view === 'students' ? Students() : view === 'types' ? Types() : view === 'transfers' ? <TransfersView data={data} pending={projection.pending} renderPending={pendingCard} onOpen={openEvent}/> : view === 'appearance' ? <AppearanceSettings/> : view === 'history' ? <HistoryView data={data} now={now} onOpen={event => setDialog({ kind: 'event-details', event })} onStatus={statusEvent}/> : Settings();
  return <><div ref={layoutRef} data-workspace-view={view} class={`layout ${draggingId ? 'is-dragging-event' : ''} ${sidebarCollapsed ? 'sidebar-collapsed' : ''} ${view==='schedule'?'is-calendar-workspace':''}`}><Sidebar cloudConfigured={cloudConfigured} collapsed={sidebarCollapsed} onToggle={toggleSidebar} view={view} onChange={switchView} pending={projection.pending.length} account={account} onSignIn={demoOnly && onPersonal ? onPersonal : signIn} onHome={onHome}/>
    <main class="main"><div class="mobile-workspace-header"><Brand onClick={event=>{event.preventDefault();onHome?.();}}/><div class="mobile-header-actions"><SyncStatus account={account} mode={mode} onSync={workspace.sync}/><button class="mobile-profile" aria-label="Настройки аккаунта" onClick={()=>switchView('settings')}>{account.user?initials(account.user.displayName||account.user.email):'Я'}</button></div></div><header class={`page-header ${view === 'schedule' ? 'calendar-topbar' : ''}`}>{view === 'schedule' ? (<div class="calendar-heading-group"><h1 class="sr-only">Расписание</h1><div class="calendar-period"><h2>{dateLabel(week, { day: rangeView === 'day' ? 'numeric' : undefined, month: 'long', year: 'numeric' })}</h2>{rangeView !== 'month' && range.start.slice(0, 7) !== range.end.slice(0, 7) && <span>{dateLabel(range.start)} — {dateLabel(range.end)}</span>}</div><div class="week-navigation"><button class="icon-button" aria-label="Предыдущий период" onClick={() => navigateWeek(-1)}><Icon name="left"/></button><button class="icon-button" aria-label="Следующий период" onClick={() => navigateWeek(1)}><Icon name="right"/></button></div>
      </div>) : <h1 class="sr-only">{TITLES[view]}</h1>}{view === 'schedule' && <div class="range-switch" role="group" aria-label="Период расписания">{[['day','День'],['week','Неделя'],['month','Месяц']].map(([id,label]) => <button type="button" key={id} aria-pressed={rangeView === id} class={rangeView === id ? 'active' : ''} onClick={() => selectRange(id)}>{label}</button>)}</div>}<div class="header-actions"><SyncStatus account={account} mode={mode} onSync={workspace.sync}/>{view === 'settings' && !account.user && <Button disabled={account.loading} onClick={demoOnly && onPersonal ? onPersonal : signIn}>{cloudConfigured ? 'Войти через Google' : 'Подключить облако'}</Button>}<button class="icon-button" aria-label="Настройки" onClick={() => switchView('settings')}><Icon name="settings"/></button>{['schedule','students','types'].includes(view) && <Button kind="primary" icon="plus" onClick={() => view === 'students' ? setDialog({ kind: 'record-choice' }) : view === 'types' ? setDialog({ kind: 'type-editor' }) : newEvent()}>{view === 'students' ? 'Добавить запись' : view === 'types' ? 'Создать тип' : 'Добавить событие'}</Button>}</div></header>
    {mode === 'demo' && <div class="demo-banner"><Icon name="info"/><span>Деморасписание с вымышленными данными. Пробуй карточки, поля и переносы.</span><button class="text-button" onClick={() => attempt(() => switchMode('personal'))}>Создать своё <Icon name="arrow"/></button></div>}
    {account.error && <div class="account-banner error" role="alert"><span>{account.error}</span><Button onClick={workspace.reconnect}>Подключиться заново</Button></div>}
    {mode === 'cloud' && (!account.ready || !account.online) && <div class="account-banner" role="status">{!account.online ? 'Нет интернета. Расписание доступно для просмотра; для сохранения нужно подключение.' : 'Показана сохранённая копия. Обновляем расписание… Сохранение станет доступно после подключения.'}</div>}
    {stale && <div class="demo-banner"><span>Расписание изменилось в другой вкладке или на другом устройстве.</span><Button onClick={() => attempt(() => { if (dialog && !confirm('Закрыть редактор и загрузить обновлённое расписание?')) return; workspace.refresh(); close(); setDeletion(null); setUndo(null); })}>Обновить данные</Button></div>}
    <div class="reminder-inbox" aria-label="Напоминания" aria-live="polite">{activeReminders(data).filter(reminder => Date.parse(reminder.at) <= now).map(reminder => <article class="reminder-notice" key={reminder.id}><div><strong>{reminderMessage(data,reminder).title}</strong><p>Всё ещё ждёт переноса</p></div><Button onClick={()=>openEvent(reminder.eventId)}>Открыть событие</Button><button type="button" class="text-button" onClick={()=>attempt(()=>commit(removeReminder(data,reminder.eventId),'Напоминание убрано'))}>Убрать</button></article>)}</div>
    {body}<footer class="page-footer">{mode!=='cloud' && <span>Сохранено в этом браузере</span>}<span>Московское время · UTC+3</span></footer></main></div>
    <TouchMovePicker controller={picker} dragging={Boolean(touch.drag || movePicker?.native)} onHover={setMoveHover} title={picker.drag ? eventTitle(data, picker.drag.item) : ''} onChoose={(event, date) => { cancelMovePicker(); dropTouchEvent(event, date); }}/>
    <PressDragGhost controller={touch} title={touch.drag ? eventTitle(data, touch.drag.item) : ''}/>
    {dialog?.kind === 'event-editor' && <EventEditor key={dialog.original?.id || 'new-event'} data={data} {...dialog} onDelete={() => setDeletion({ kind: 'event', value: dialog.original })} onSave={commit} onClose={close} onNewStudent={draft => setDialog({ kind: 'student-editor', returnTo: { ...dialog, draft } })} onNewRecord={(category, draft) => setDialog({ kind: 'record-editor', category, returnTo: { ...dialog, draft } })}/>}
    {dialog?.kind === 'reminder' && <ReminderDialog key={dialog.event.id} data={data} event={dialog.event} now={now} onClose={close} onSave={value=>commit(saveReminder(data,dialog.event.id,value),'Напоминание сохранено')} onRemove={()=>attempt(()=>commit(removeReminder(data,dialog.event.id),'Напоминание убрано'))} pushReady={PUSH_READY && mode==='cloud'} onEnablePush={()=>enablePushForUser(account.user)}/>}
    {dialog?.kind === 'event-details' && <EventDetails data={data} event={dialog.event} now={now} onRestore={() => returnEvent(dialog.event)} onRemind={() => setDialog({kind:'reminder',event:dialog.event})} onStop={() => setDialog({ kind: 'stop-series', event: dialog.event })} onClose={close} onDelete={() => setDeletion({ kind: 'event', value: dialog.event })} onEdit={() => editEvent(dialog.event)} onMove={() => openMovePicker(dialog.event)} onRecord={record => setDialog({ kind: 'record-details', record })} onStatus={status => statusEvent(dialog.event, status)} onStudent={student => setDialog({ kind: 'student-details', student })}/>}
    {dialog?.kind === 'student-editor' && <StudentEditor data={data} original={dialog.original} onDelete={() => setDeletion({ kind: 'record', value: dialog.original })} onClose={() => dialog.returnTo ? setDialog(dialog.returnTo) : close()} onSave={(next, message, student) => { const returnTo = dialog.returnTo; const finish = ok => { if (!ok) return; if (returnTo) setDialog({ ...returnTo, draft: { ...returnTo.draft, studentId: student.id, recordId: student.id, title: returnTo.draft.title || student.name, color: student.color } }); }; const result = commit(next, message); return result?.then ? result.then(finish) : finish(result); }}/>}
    {dialog?.kind === 'student-details' && <StudentDetails data={data} student={dialog.student} onDelete={() => setDeletion({ kind: 'record', value: dialog.student })} onClose={close} onEdit={() => setDialog({ kind: 'student-editor', original: dialog.student })} onEvent={() => newEvent(selectedDate, dialog.student.id)}/>}
    {dialog?.kind === 'stop-series' && <StopSeriesDialog data={data} event={dialog.event} onSave={commit} onClose={close}/>}
    {dialog?.kind === 'move-editor' && <MoveEditor data={data} event={dialog.event} date={dialog.date} onRestore={() => returnEvent(dialog.event)} onClose={close} onSave={commit} onAdvanced={draft => setDialog({ kind: 'event-editor', original: dialog.event, draft })}/>}
    {dialog?.kind === 'record-choice' && <Modal title="Что добавить?" subtitle="Общие записи можно связывать с разными событиями." onClose={close}><div class="record-choice">{Object.entries(RECORD_KINDS).map(([kind, label]) => <Button key={kind} onClick={() => setDialog({ kind: kind === 'student' ? 'student-editor' : 'record-editor', category: kind })}>{label}</Button>)}<Button onClick={() => setDialog({ kind: 'record-editor', category: 'Моя категория' })}>Своя категория</Button></div></Modal>}
    {dialog?.kind === 'record-editor' && <RecordEditor data={data} original={dialog.original} onDelete={() => setDeletion({ kind: 'record', value: dialog.original })} category={dialog.category} onClose={() => dialog.returnTo ? setDialog(dialog.returnTo) : close()} onSave={(next, message, record) => { const returnTo = dialog.returnTo; const finish = ok => { if (!ok) return; if (returnTo) setDialog({ ...returnTo, draft: { ...returnTo.draft, recordId: record.id, studentId: '', title: returnTo.draft.title || record.name, color: record.color } }); }; const result = commit(next, message); return result?.then ? result.then(finish) : finish(result); }}/>}
    {dialog?.kind === 'record-details' && <RecordDetails record={dialog.record} onDelete={() => setDeletion({ kind: 'record', value: dialog.record })} onClose={close} onEdit={() => setDialog({ kind: 'record-editor', original: dialog.record })} onEvent={() => newEventForRecord(dialog.record)}/>}
    {dialog?.kind === 'type-editor' && <TypeEditor data={data} original={dialog.original} onDelete={() => setDeletion({ kind: 'type', value: dialog.original })} onClose={close} onSave={commit}/>}
    {deletion && <DeleteDialog data={data} target={deletion} onSave={commit} onClose={() => setDeletion(null)}/>}
    <MobileNav view={view} onChange={switchView} pending={projection.pending.length} onHome={onHome}/>
    {account.saving && <div class="save-shield" role="status" aria-live="polite"><span>Сохраняем изменения…</span></div>}
    {notice && <div id="notice" class="visible" role="status"><span>{notice.text}</span>{notice.canUndo && undo && undo.mode === mode && undo.revision === data.revision && <button class="toast-undo" onClick={() => attempt(() => { if (undo.revision !== data.revision || undo.mode !== mode) throw new Error('Расписание уже изменилось; это действие больше нельзя отменить.'); const previous = undo.data; const result = commit(previous, 'Последнее изменение отменено'); if (result?.then) return result.then(ok => { if (ok) setUndo(null); }); setUndo(null); })}>Отменить</button>}</div>}
  </>;
}
