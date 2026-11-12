import { CloudSettings } from './components/CloudSettings.jsx';
import { useWorkspaceTheme } from './theme/ThemeProvider.jsx';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { lazy, Suspense } from 'preact/compat';
import { AppearanceSettings } from './components/AppearanceSettings.jsx';
import { TemplateWorkspace } from './components/TemplateWorkspace.jsx';
import { RecordsDirectory } from './components/RecordsDirectory.jsx';
import { MarkerPaint } from './components/MarkerPaint.jsx';
import { Sidebar } from './components/Sidebar.jsx';
import { Brand } from './components/Brand.jsx';
import { WorkspaceEntry } from './components/WorkspaceEntry.jsx';
import { MobileNav } from './components/MobileNav.jsx';
import { Icon } from './components/Icon.jsx';
import { Button, Search, Check, dateLabel, initials, dayNames, longDays } from './components/UI.jsx';
import { GuideView } from './components/GuideView.jsx';
import { StatisticsView } from './components/StatisticsView.jsx';
import { JournalView } from './components/JournalView.jsx';
import { PendingEventCard, PendingQueue } from './components/PendingEvents.jsx';
import { StopSeriesDialog } from './components/StopSeriesDialog.jsx';
import { DEFAULT_STATE_EFFECTS } from './lib/state-appearance.js';
import { setEventStatus } from './lib/event-history.js';
import { EventCard } from './components/EventCard.jsx';
import { WeekCalendar } from './components/WeekCalendar.jsx';
import { MobileCalendarFooter, MobileCalendarHeader, MobileCalendarMonth, MobileCalendarWeek, MobileCalendarYear, useMobileCalendarViewport } from './components/MobileCalendar.jsx';
import { CalendarClickWave } from './components/CalendarClickWave.jsx';
import { HOUR_HEIGHT, readTimeTarget, timelineDropTarget } from './lib/week-layout.js';
import { EventEditor } from './components/EventEditor.jsx';
import { ReminderDialog } from './components/ReminderDialog.jsx';
import { SyncStatus } from './components/SyncStatus.jsx';
import { EventDetails } from './components/EventDetails.jsx';
import { EventAlertEditor } from './components/EventAlertEditor.jsx';
import { TaskBoard } from './components/TaskBoard.jsx';
import { TaskEditor } from './components/TaskEditor.jsx';
import { StudentEditor, StudentDetails } from './components/StudentEditor.jsx';
import { DeleteDialog } from './components/DeleteDialog.jsx';
import { MoveEditor } from './components/MoveEditor.jsx';
import { RecordEditor, RecordDetails } from './components/RecordEditor.jsx';
import { Modal, SaveErrorContext } from './components/UI.jsx';
const MapView = lazy(() => import('./components/MapView.jsx'));
import { addDays, monthStart, todayISO, weekdayOf, minutesToTime } from './lib/domain.js';
import { getStudent, projectWeek, eventTitle, eventColor, eventMatches, moveEvent, saveMove, restoreMove, isEventMoved, assertNoConflict, normalizeData, calendarRange, recordKind, recordKinds, RECORD_KINDS, setTemplateArchived, findOccurrence, validEventAlerts } from './lib/events.js';
import { loadData, demoData, exportData } from './lib/storage.js';
import { TouchMovePicker, PressDragGhost } from './components/TouchMovePicker.jsx';
import { useCalendarSwipe } from './hooks/useCalendarSwipe.js';
import { CALENDAR_BUFFER_DAYS } from './hooks/useCalendarPan.js';
import { usePressDrag, touchDropTarget } from './hooks/usePressDrag.js';
import { useWorkspace } from './hooks/useWorkspace.js';
import { useDeviceAlarms } from './hooks/useDeviceAlarms.js';
import { activeReminders, saveReminder, removeReminder, reminderMessage, reminderLabel, removeEventAlert } from './lib/reminders.js';
import { explainWorkspaceError } from './lib/workspace-provider.js';
import { eventAlertDeadline } from './lib/reminder-model.js';
import { archiveTasks, setTaskStatus } from './lib/tasks.js';

const TITLES = { appearance:'Внешний вид', schedule: 'Расписание', board:'Доска', students: 'Записи', types: 'Редактор шаблонов', history: 'Журнал', statistics: 'Статистика', guide: 'Руководство пользователя', settings: 'Настройки' };
const alertPlural = new Intl.PluralRules('ru');
const cancelledAlertsLabel = items => {
  const groups = [[items.filter(item=>item.alarmDevice).length, ['будильник','будильника','будильников']],
    [items.filter(item=>!item.alarmDevice).length, ['напоминание','напоминания','напоминаний']]];
  return groups.filter(([count])=>count > 0).map(([count, [one, few, many]])=>{
    const form = { one, few, many }[alertPlural.select(count)] || many;
    return `Отменено ${count} ${form}`;
  }).join('. ');
};
const eventCount = count => `${count} ${{one:'событие',few:'события',many:'событий',other:'события'}[new Intl.PluralRules('ru').select(count)]}`;

export function App({ initialMode, demoOnly = false, requireAccount = false, provider = null, nativeAlarms = null, onHome, onPersonal, onDemo } = {}) {
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
  const [selectedEventId,setSelectedEventId]=useState('');
  const [deletion, setDeletion] = useState(null);
  const [movePicker, setMovePicker] = useState(null);
  const [moveHover, setMoveHover] = useState(null);
  const layoutRef = useRef(null);
  const [touchMoving, setTouchMoving] = useState(false);
  const [resizing,setResizing]=useState(false);
  const [templateEditing,setTemplateEditing] = useState(false);
  const [templateSession,setTemplateSession] = useState(0);
  const workspace = useWorkspace(Boolean(dialog || deletion || touchMoving || resizing || movePicker || templateEditing), { initialMode, demoOnly, provider });
  const { data, mode } = workspace.session;
  const { account, stale } = workspace;
  const alerts = useMemo(()=>validEventAlerts(data),[data]);
  const alarms = useDeviceAlarms(nativeAlarms, account, alerts, stale);
  const cloudConfigured = Boolean(provider);
  const signInLabel = provider?.signInLabel || 'Войти';
  const explainError = error => provider?.explainError?.(error) || explainWorkspaceError(error);
  const signIn = () => cloudConfigured ? workspace.signIn() : switchView('settings');
  const [view, setView] = useState('schedule');
  const [guideChapter,setGuideChapter] = useState(0);
  useEffect(()=>{setSelectedEventId('');},[view,account.user?.id]);
  useEffect(()=>{
    if(!selectedEventId || dialog) return;
    const clear = event => {
      if (event.type==='keydown' ? event.key==='Escape' : !event.target.closest?.('.event-card,.week-resize-handle')) setSelectedEventId('');
    };
    document.addEventListener('pointerdown',clear);
    document.addEventListener('keydown',clear);
    return ()=>{document.removeEventListener('pointerdown',clear);document.removeEventListener('keydown',clear);};
  },[selectedEventId,dialog]);
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
  const [desktopRange, setDesktopRange] = useState('week');
  const [mobileLevel, setMobileLevel] = useState('day');
  const mobileCalendar = useMobileCalendarViewport();
  const rangeView = mobileCalendar ? (mobileLevel === 'day' ? 'day' : 'month') : desktopRange;
  const [weekStart, setWeekStart] = useState(null);
  const [calendarFocus, setCalendarFocus] = useState(0);
  const scheduleRef = useRef(null);
  const [mapView, setMapView] = useState(false);
  const [weekLayout,setWeekLayout]=useState(()=>localStorage.getItem('potok:week-layout')==='board'?'board':'timeline');
  const [visibleHours,setVisibleHours]=useState([0,24]);
  const [pendingOpen,setPendingOpen]=useState(false);
  const timeline=rangeView!=='month' && (mobileCalendar || weekLayout==='timeline');
  const [compact, setCompact] = useState(true);
  const [cardOverrides, setCardOverrides] = useState({});
  const [recordFilter, setRecordFilter] = useState('');
  const [selectedDate, setSelectedDate] = useState(today);
  const [query, setQuery] = useState('');
  const [filterType, setFilterType] = useState('');
  const [showGhosts, setShowGhosts] = useState(true);
  const [templateDraft,setTemplateDraft] = useState('');
  const templateLeaveGuard = useRef(null);
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
  useEffect(() => { const date = todayISO(new Date(Date.now())); setDialog(null); setDeletion(null); setUndo(null); setNotice(null); setQuery(''); setFilterType(''); setWeek(date); setSelectedDate(date); setDesktopRange('week'); setMobileLevel('day'); setWeekStart(null); setView('schedule'); setTemplateDraft(''); setMovePicker(null); }, [account.user?.id]);

  const commit = (next, message, date, {canUndo = true, keepDialog = false} = {}) => {
    const finish = saved => {
      if (filterType && !next.types.some(type => type.id === filterType)) setFilterType('');
      const remaining = new Set((saved.eventAlerts || []).map(item=>item.id));
      const cancelled = (next.eventAlerts || []).filter(item=>!remaining.has(item.id) && Date.parse(item.at)>now);
      const cancelledIds = new Set(cancelled.map(item=>item.id));
      const previous = cancelled.length ? { ...data, eventAlerts:(data.eventAlerts || []).filter(item=>!cancelledIds.has(item.id)) } : data;
      setDeletion(null); setUndo(canUndo ? { data:previous, revision: saved.revision, mode } : null);
      if (!keepDialog) setDialog(null);
      if (date) { if (mobileCalendar || date < range.start || date > range.end) { setWeek(date); setWeekStart(null); } setSelectedDate(date); }
      notify(cancelled.length ? `${message}. ${cancelledAlertsLabel(cancelled)}` : message, canUndo);
      return true;
    };
    const result = workspace.save(next);
    if (result?.then) return result.then(finish).catch(error => { notify(explainError(error)); return false; });
    return finish(result);
  };
  const attempt = action => { try { const result = action(); if (result?.catch) result.catch(error => notify(explainError(error))); } catch (error) { notify(explainError(error)); } };
  const close = () => setDialog(null);
  const closeSubEditor = () => setDialog(dialog.returnTo || null);
  const saveSubEditor = async (next, message) => {
    const parent = dialog.returnTo;
    const saved = await commit(next, message, undefined, { keepDialog:Boolean(parent) });
    if (saved && parent) setDialog(parent);
    return saved;
  };
  const newEvent = (date = selectedDate, studentId = '', start) => {
    const available = data.types.filter(type => !type.archived);
    const typeId = studentId
      ? (available.find(type => recordKind(type) === 'student') || available.find(type => recordKind(type) === 'any'))?.id
      : (available.find(type => type.id === filterType) || available.find(type => type.id === 'personal') || available[0])?.id;
    if (!typeId) {
      setTemplateDraft('events'); setView('types');
      notify('Сначала создай шаблон события.');
      return;
    }
    const student = getStudent(data, studentId);
    setDialog({ kind: 'event-editor', date, typeId, draft: student ? { studentId, recordId: studentId, title: student.name, color: student.color, ...(start===undefined?{}:{start:minutesToTime(start)}) } : start===undefined?undefined:{start:minutesToTime(start)} });
  };
  const findEvent = id => findOccurrence(data, id);
  const openEvent = (id, {showPlace=false, anchor}={}) => { const event = findEvent(id); if (event) setDialog({ kind: 'event-details', event, showPlace, anchor }); };
  useEffect(() => {
    if (requireAccount && (!account.user || !account.hasData)) return;
    const params = new URLSearchParams(window.location.search);
    const eventId = params.get('event');
    if (!eventId || params.get('uid') && params.get('uid') !== account.user?.id) return;
    const event = findOccurrence(data, eventId);
    if (!event) return;
    setDialog({kind:'event-details',event});
    params.delete('event'); params.delete('uid');
    history.replaceState(null,'',window.location.pathname + (params.size ? '?' + params.toString() : '') + window.location.hash);
  }, [account.user?.id, account.hasData, data.revision]);
  const editEvent = (event, date) => setDialog({ kind: 'event-editor', original: event, date });
  const newEventForRecord = record => {
    if (record.kind === 'student') { newEvent(selectedDate, record.id); return; }
    const type = data.types.find(type => !type.archived && recordKind(type) === record.kind) || data.types.find(type => !type.archived && recordKind(type) === 'any');
    if (!type) { setView('types'); close(); notify('В редакторе шаблонов укажи, с какими записями можно связать событие.'); return; }
    setDialog({ kind: 'event-editor', date: selectedDate, typeId: type.id, draft: { recordId: record.id, title: record.name, color: record.color } });
  };
  const canLeaveTemplates = () => view !== 'types' || !templateLeaveGuard.current || templateLeaveGuard.current();
  const goHome = onHome && (() => { if (canLeaveTemplates()) onHome(); });
  const resetTemplateWorkspace = () => { setTemplateDraft(''); setTemplateSession(value => value + 1); };
  const switchView = target => {
    if (target !== view && !canLeaveTemplates()) return;
    if (target !== 'types') setTemplateDraft('');
    setView(target); setQuery(''); setSidebarCollapsed(true);
    if (target === 'schedule') goToday();
  };
  const switchMode = nextMode => {
    if (!canLeaveTemplates()) return;
    if (nextMode === 'personal' && onPersonal) { onPersonal(); return; }
    if (nextMode === 'demo' && onDemo) { onDemo(); return; }
    workspace.switchMode(nextMode);
    setTemplateDraft('');
    setDialog(null); setDeletion(null); setUndo(null); setQuery(''); setFilterType('');
    notify(nextMode === 'personal' ? 'Открыто твоё расписание. Демо хранится отдельно.' : 'Открыт отдельный пример расписания.');
  };
  const goToday = () => {
    setWeek(today); setSelectedDate(today); setWeekStart(null); setCalendarFocus(value=>value+1);
    if (mobileCalendar) { setMobileLevel('day'); setMapView(false); setSelectedEventId(''); }
  };
  const selectRange = nextView => {
    if (nextView === rangeView) goToday();
    else { setDesktopRange(nextView); setWeek(selectedDate); setWeekStart(null); setCalendarFocus(value=>value+1); }
  };
  const showMobilePeriod = (level, date = selectedDate) => {
    setSelectedEventId(''); setMapView(false); setWeekStart(null);
    setSelectedDate(date); setWeek(date); setMobileLevel(level);
    if (level === 'day') setCalendarFocus(value => value + 1);
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
    if (mobileCalendar) setSelectedEventId('');
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
    else if(gestureMode!=='calendar') attempt(()=>commit(saveMove(data,event,date,start),'Событие перенесено',date));
    else moveDialog(event,date);
  };
  const dropTouchEvent = (event,target,gestureMode) => placeEvent(event,target,gestureMode||'calendar');
  const touch = usePressDrag({ root: layoutRef, enabled: view === 'schedule' && !dialog && !deletion && !movePicker && !resizing && !account.saving && (!requireAccount || account.hasData), selector: '[data-event-id]', quickDrag:true, quickDragMode:timeline?'timeline':'board',
    canQuickDrag: node => !mobileCalendar || !node.classList.contains('timeline-card') || node.dataset.eventId === selectedEventId,
    getItem: (node,point) => { rememberGrab(node,point);const event = [...stripProjection.events,...projection.pending].find(item => item.id === node.dataset.eventId); return event?.status !== 'done' ? event : null; },
    hitTest: (point,mode) => mode === 'timeline' ? timelineDropTarget(point,findEvent(dragId.current)?.duration,grabOffset.current) : mode === 'board' ? touchDropTarget(point,'[data-board-drop]','data-board-drop') : touchDropTarget(point, '[data-press-drop]', 'data-press-drop') || touchDropTarget(point, '[data-press-page]', 'data-press-page') || touchDropTarget(point, '[data-press-action]', 'data-press-action'),
    onDrop: dropTouchEvent, onHover:(date,mode)=>{if(mode!=='calendar')setDropTarget(date||'');}, onActiveChange:(active,mode,item)=>{setTouchMoving(active);if(active && mode!=='calendar'){dragId.current=item.id;setDraggingId(item.id);}if(!active){dragId.current=null;setDraggingId('');setDropTarget('');}},
  });
  const cancelMovePicker = () => { touch.cancel(); endDrag(); };
  const picker = movePicker ? { drag: { item: movePicker.event }, hover: moveHover, cancel: cancelMovePicker } : touch.drag && touch.drag.mode !== 'calendar' ? {...touch,drag:null} : touch;
  useCalendarSwipe(scheduleRef, shiftDay, view === 'schedule' && !timeline && rangeView !== 'month' && !mapView && !dialog && !deletion && !picker.drag && !draggingId, rangeView);
  const statusEvent = (event, status) => attempt(() => {
    if (status === 'planned' && !event.date) { moveDialog(event); return; }
    if (status === 'cancelled' && !confirm('Отменить только это событие? История и остальные повторы сохранятся.')) return;
    const next = status === 'pending' ? moveEvent(event, null, event.start, event.duration) : event;
    if (status === 'planned') assertNoConflict(data, next);
    commit(setEventStatus(data, next, status, now), status === 'pending' ? 'Событие ждёт новой даты' : 'Статус события изменён');
  });
  const drop = (event, target) => {
    event.preventDefault();
    const id = dragId.current;
    endDrag();
    const item = findEvent(id); if (!item) return;
    placeEvent(item,target);
  };
  const dropProps = target => ({ onDragOver: event => { if (dragId.current) { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; if (dropTarget !== target) setDropTarget(target); } }, onDragLeave: event => { if (!event.currentTarget.contains(event.relatedTarget)) setDropTarget(''); }, onDrop: event => drop(event, target) });
  const pendingCard = (event, journal = false, inBoard = false) => <PendingEventCard key={event.id} event={event} journal={journal} data={data} onOpen={openEvent} onRemind={item=>setDialog({kind:'reminder',event:item})} onMove={moveDialog} onRestore={returnEvent} onDragStart={inBoard ? undefined : (item,input)=>{dragId.current=item.id;setDraggingId(item.id);input.dataTransfer.setData('text/plain',item.id);input.dataTransfer.effectAllowed='move';}} onDragEnd={endDrag}/>;


  const calendarOptions = view === 'schedule' && <div class="schedule-controls"><div class="calendar-filters">{!mobileCalendar && <Search value={query} onChange={setQuery}/>}<select aria-label="Тип событий" class="type-filter" value={filterType} onChange={event => setFilterType(event.currentTarget.value)}><option value="">Все шаблоны</option>{data.types.map(type => <option key={type.id} value={type.id}>{type.name}</option>)}</select></div><div class="schedule-view-controls"><Button icon={mapView ? 'calendar' : 'pin'} onClick={() => setMapView(!mapView)}>{mapView ? 'Расписание' : 'На карте'}</Button>{!mobileCalendar && !mapView && !timeline && <Button onClick={() => { setCompact(!compact); setCardOverrides({}); }}>{compact ? 'Раскрыть карточки' : 'Свернуть карточки'}</Button>}{timeline && <div class="week-hours"><label>Часы<select aria-label="Начало видимых часов" value={visibleHours[0]} onChange={input=>setVisibleHours([Number(input.currentTarget.value),visibleHours[1]])}>{[0,5,6,7,8,9,10,12].filter(hour=>hour<visibleHours[1]).map(hour=><option key={hour} value={hour}>{minutesToTime(hour*60)}</option>)}</select><span>—</span><select aria-label="Конец видимых часов" value={visibleHours[1]} onChange={input=>setVisibleHours([visibleHours[0],Number(input.currentTarget.value)])}>{[16,18,20,22,23,24].filter(hour=>hour>visibleHours[0]).map(hour=><option key={hour} value={hour}>{hour===24?'24:00':minutesToTime(hour*60)}</option>)}</select></label><small>Диапазон расширяется, если событие выходит за его пределы.</small></div>}<Check checked={showGhosts} onChange={setShowGhosts}>Показывать старое время</Check></div></div>;

  function Schedule() {
    const filtered = visibleEvents;
    const hours = filtered.reduce((total, event) => total + event.duration, 0) / 60;
    return <><section class={`schedule-panel ${timeline?'is-timeline':''}`} aria-label="Расписание событий" data-ui ref={scheduleRef}>
      {!mobileCalendar && <div class="calendar-options-bar">{rangeView!=='month' && <div class="week-layout-switch" role="group" aria-label={rangeView==='day'?'Вид дня':'Вид недели'}>{[['timeline','По времени'],['board','По дням']].map(([id,label])=><button type="button" key={id} aria-pressed={weekLayout===id} onClick={()=>{setWeekLayout(id);localStorage.setItem('potok:week-layout',id);}}>{label}</button>)}</div>}{filtered.length > 0 && <span class="period-count">{eventCount(filtered.length)} · {hours.toLocaleString('ru-RU', { maximumFractionDigits: 1 })} ч</span>}{(query || filterType) && <button type="button" class="text-button filter-reset" onClick={() => { setQuery(''); setFilterType(''); }}>Сбросить фильтры ×</button>}{projection.pending.length > 0 && <button type="button" class="pending-shortcut" onClick={() => setPendingOpen(!pendingOpen)} aria-expanded={pendingOpen} aria-controls="schedule-pending"><Icon name="clock"/>Ждут новой даты <span>{projection.pending.length}</span></button>}<details class="calendar-options"><summary><Icon name="sliders"/>Вид и фильтры{(query || filterType) && <span class="filter-dot"/>}</summary>{calendarOptions}</details></div>}
      {mobileCalendar && mobileLevel === 'day' && !mapView && <MobileCalendarWeek date={selectedDate} today={today} onDate={date => showMobilePeriod('day', date)}/>}
      {mapView ? <Suspense fallback={<p class="empty-copy">Загружаю карту…</p>}><MapView events={filtered} data={data} onOpen={openEvent}/></Suspense> :
        mobileCalendar && mobileLevel === 'year' ? <MobileCalendarYear date={week} today={today}
          onMonth={month => showMobilePeriod('month', selectedDate.slice(0, 7) === month.slice(0, 7) ? selectedDate : month)}
          onStep={delta => showMobilePeriod('year', monthStart(week, 12 * delta))}/> :
        mobileCalendar && mobileLevel === 'month' ? <MobileCalendarMonth date={week} today={today} data={data} events={filtered}
          onDate={date => showMobilePeriod('day', date)} onStep={delta => showMobilePeriod('month', monthStart(week, delta))}/> :
        timeline ? <><WeekCalendar mobileDay={mobileCalendar} selectedEventId={selectedEventId} motionPaused={Boolean(dialog || deletion || movePicker || touchMoving || resizing || draggingId)} onSelectEvent={setSelectedEventId} days={days} events={stripEvents} ghosts={stripGhosts} focusKey={calendarFocus} onShift={shiftDay} panEnabled={!dialog && !deletion && !picker.drag && !draggingId && !resizing} canEdit={!account.saving && (!requireAccount || account.hasData)} onResizeActive={setResizing} onResize={(event,timing)=>attempt(()=>commit(saveMove(data,event,event.date,timing.start,timing.duration),'Продолжительность изменена',event.date))} data={data} now={now} today={today} selectedDate={selectedDate} onSelectDate={selectCalendarDate} onOpen={openEvent} onCreate={(date,start)=>newEvent(date,'',start)} onDragStart={(id,input)=>{rememberGrab(input.currentTarget,{y:input.clientY});dragId.current=id;setDraggingId(id);}} onDragEnd={endDrag} onDrop={drop} onHover={setDropTarget} draggingId={draggingId} draggedEvent={findEvent(draggingId)} dropTarget={dropTarget} grabOffset={grabOffset.current} fromHour={visibleHours[0]} toHour={visibleHours[1]}/></> : <>
      <div class={`mobile-days ${rangeView === 'month' ? 'is-month-picker' : ''}`} aria-label="Дни периода">{days.map(date => <button key={date} data-board-drop={date} aria-pressed={date === selectedDate} class={`mobile-day ${date === selectedDate ? 'selected' : ''} ${dropTarget === date ? 'board-drop-target' : ''} ${date === today ? 'is-current-day' : date < today ? 'is-past-picker-day' : ''} ${rangeView === 'month' && date.slice(0,7) !== week.slice(0,7) ? 'outside-picker-month' : ''}`} onClick={() => setSelectedDate(date)} data-state-effect={DEFAULT_STATE_EFFECTS.pastDay}>{date < today && <MarkerPaint/>}<span>{dayNames[weekdayOf(date)]}</span><strong>{Number(date.slice(8))}</strong><i class={filtered.some(event=>event.date===date)?'has-events':''}/></button>)}</div>
      <div class={`calendar-scroll range-${rangeView}`}><div class={`calendar-grid calendar-${rangeView}`}>{days.map(date => {
        const events = filtered.filter(event => event.date === date);
        const ghosts = showGhosts ? projection.ghosts.filter(event => event.date === date && eventMatches(data, event, query, filterType)) : [];
        const cards = [...events, ...ghosts].sort((a, b) => a.start - b.start);
        return <section key={date} data-board-drop={date} class={`day-column ${date === selectedDate ? 'mobile-selected' : ''} ${date === today ? 'is-today' : date < today ? 'is-past-day' : ''} ${rangeView === 'month' && date.slice(0, 7) !== week.slice(0, 7) ? 'outside-month' : ''} ${dropTarget === date ? 'drop-target' : ''}`} {...dropProps(date)} aria-label={`${longDays[weekdayOf(date)]}, ${dateLabel(date)}`}>
          <header class="day-header" data-day-state={date < today ? 'past' : date === today ? 'today' : 'future'} data-state-effect={DEFAULT_STATE_EFFECTS.pastDay} title={date < today ? 'Этот день прошёл' : undefined}>{date < today && <MarkerPaint/>}<span>{dayNames[weekdayOf(date)]}</span><div><strong>{Number(date.slice(8))}</strong>{date === today ? <span class="today-tag">сегодня</span> : null}</div></header>
          <div class="day-body">{draggingId && dropTarget === date && <div class="drop-preview" aria-live="polite"><Icon name="arrows"/><strong>{findEvent(draggingId)?.date === date ? 'Оставить на месте' : isEventMoved(findEvent(draggingId) || {}) && (findEvent(draggingId)?.originalDate || findEvent(draggingId)?.anchorDate) === date ? 'Отпустить — отменить перенос' : 'Отпустить — выбрать время'}</strong></div>}{cards.map(event => <EventCard key={`${event.id}:${event.ghost ? 'ghost' : 'live'}`} event={event} data={data} now={now} onOpen={openEvent} onSelect={setSelectedEventId} selected={selectedEventId===event.id} motionPaused={Boolean(dialog || deletion || draggingId || picker.drag)} onDelete={event => setDeletion({ kind: 'event', value: event })} expanded={cardOverrides[event.id] ?? !compact} onMove={openMovePicker} onDefer={event => statusEvent(event, 'pending')} onToggle={id => setCardOverrides(previous => ({ ...previous, [id]: !(previous[id] ?? !compact) }))} isDragging={draggingId === event.id && !event.ghost} canRestore={event.ghost && draggingId === event.id} onRestoreDrop={() => returnEvent(findEvent(event.id))} onDragStart={id => { const event = findEvent(id); if (!event) return; dragId.current = id; setDraggingId(id); }} onDragEnd={endDrag}/>) }
          {!cards.length && <div class="free-day"><span>{query || filterType ? 'Нет событий' : 'Свободно'}</span></div>}<button class="add-slot" onClick={() => newEvent(date)} aria-label={`Добавить событие на ${dateLabel(date)}`}><Icon name="plus"/>Событие</button></div>
        </section>;
      })}</div></div></>}
      {!mapView && (!mobileCalendar || mobileLevel === 'day') && <CalendarClickWave scheduleRef={scheduleRef}/>}
      </section><PendingQueue events={projection.pending} hidden={!pendingOpen && !draggingId} target={dropTarget} dropProps={dropProps('pending')} renderEvent={event=>pendingCard(event)} onClose={()=>setPendingOpen(false)}/>
      {mobileCalendar && <MobileCalendarFooter onToday={goToday} pendingCount={projection.pending.length}
        pendingOpen={pendingOpen} onPending={() => setPendingOpen(previous => !previous)}/>}</>;

  }
  function Students() {
    return <RecordsDirectory data={data} today={today} query={query} onQuery={setQuery} filter={recordFilter} onFilter={setRecordFilter} onOpen={record=>setDialog(record.kind==='student'?{kind:'student-details',student:record}:{kind:'record-details',record})} onAdd={()=>setDialog({kind:'record-choice'})}/>;
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
  const openGuide = (chapter = 0) => {setGuideChapter(chapter);switchView('guide');};
  function Settings() {
    return <section class="settings-panel"><CloudSettings provider={provider} signedIn={Boolean(account.user)}/><article class="settings-card"><h2>Внешний вид</h2><p>Качество анимаций и чёткость изображения.</p><Button onClick={() => switchView('appearance')}>Настроить оформление</Button></article><article class="settings-card"><span class="section-caption">АККАУНТ И ХРАНЕНИЕ</span><h2>{account.user ? account.user.displayName || 'Твой аккаунт' : cloudConfigured ? 'Твои планы на любом устройстве' : 'Данные на устройстве'}</h2><p>{account.user ? `${account.user.email || account.user.displayName || 'Аккаунт'} · ${provider?.name || 'Синхронизация'}` : cloudConfigured ? 'Войди в свой сервис, чтобы синхронизировать расписание между устройствами.' : 'Расписание сохраняется локально. Скачивай резервные копии для переноса данных.'}</p><div class="settings-actions">{account.user ? <><Button onClick={() => attempt(() => workspace.signOut())} disabled={account.saving}>Выйти из аккаунта</Button><Button onClick={() => { if (confirm('Заменить расписание в аккаунте личными данными из этого браузера? Текущую облачную версию можно заранее скачать.')) attempt(() => commit(loadData('personal'), 'Локальные записи перенесены в аккаунт')); }} disabled={mode !== 'cloud' || !account.hasData || account.saving}>Перенести локальные записи в аккаунт</Button></> : cloudConfigured && <Button kind="primary" disabled={account.loading} onClick={demoOnly && onPersonal ? onPersonal : signIn}>{account.loading ? 'Подключение…' : signInLabel}</Button>}</div><div class="settings-actions"><Button icon="download" onClick={() => exportData(mode, data)}>Скачать резервную копию</Button><Button onClick={() => importRef.current.click()}>Восстановить из копии</Button><input type="file" accept="application/json,.json" hidden ref={importRef} onChange={event => importFile(event.currentTarget.files[0])}/></div></article>{!requireAccount && <article class="settings-card"><span class="section-caption">РАСПИСАНИЕ</span><h2>{mode === 'demo' ? 'Демонстрационный пример' : 'Твои события'}</h2><p>Демо и личные записи хранятся отдельно. Переключение не удаляет данные.</p><Button onClick={() => attempt(() => switchMode(mode === 'demo' ? 'personal' : 'demo'))}>{mode === 'demo' ? 'Перейти к своему расписанию' : 'Открыть демо'}</Button>{mode === 'demo' && <button class="text-button" onClick={() => attempt(() => { if (confirm('Восстановить вымышленный пример? Личное расписание не изменится.')) commit(demoData(), 'Демо восстановлено'); })}>Восстановить пример</button>}</article>}<article class="settings-card"><span class="section-caption">ПОВТОРЕНИЯ И ПЕРЕНОСЫ</span><h2>Одно событие или всё расписание</h2><p>В редакторе повторяющегося события выбери, изменить только этот экземпляр или его и последующие. Разовый перенос сохраняет обычное время других недель. История остаётся внутри карточки.</p></article><article class="settings-card"><span class="section-caption">СВОИ КАРТОЧКИ</span><h2>Поля под твои события</h2><p>В «Шаблонах» можно добавлять поля, менять порядок, обязательность и видимость. Использованные поля скрываются с сохранением значений.</p><Button onClick={() => switchView('types')}>Открыть конструктор</Button></article><article class="settings-card"><h2>Руководство</h2><p>Как работать с расписанием, доской, напоминаниями и другими разделами.</p><Button onClick={()=>openGuide()}>Открыть руководство</Button></article></section>;
  }

  if (requireAccount && (!account.authResolved || (account.user && !account.hasData)) && !account.error) return <div class="planner-loading" role="status"><span class="loading-orbit"/><p>Открываем твоё пространство…</p></div>;
  if (requireAccount && (!account.user || !account.hasData)) return <WorkspaceEntry provider={provider} account={account} onSignIn={workspace.signIn} onRetry={workspace.reconnect} onSignOut={()=>attempt(workspace.signOut)} onHome={onHome} onDemo={onDemo}/>;
  const taskStatus = (id, status, keepDialog = false) => attempt(() => commit(setTaskStatus(data,id,status),
    status === 'done' ? 'Задача выполнена' : 'Статус задачи обновлён', undefined, {keepDialog}));
  const taskArchive = (ids, archived) => attempt(() => commit(archiveTasks(data,ids,archived),
    archived ? 'Задачи отправлены в архив' : 'Задачи возвращены в «Готово»'));
  const eventTasks = event => <section class="inspector-tasks">
    <header class="inspector-section-heading"><h3>Задачи</h3><Button kind="text-button" icon="plus" onClick={()=>setDialog({kind:'task',source:event,returnTo:dialog})}>Добавить стикер</Button></header>
    {(data.tasks || []).filter(task=>!task.archived && task.eventId===event.id).map(task=><div class="inspector-task" key={task.id}>
      <Check checked={task.status==='done'} onChange={done=>taskStatus(task.id,done?'done':'todo',true)} aria-label={`Выполнена: ${task.title}`}/>
      <button type="button" class="task-title" onClick={()=>setDialog({kind:'task',task,source:event,returnTo:dialog})}>{task.title}</button>
    </div>)}
  </section>;
  const pushEnabled = Boolean(provider?.notifications?.enabled) && mode==='cloud';
  const eventAlertsSection = event => {
    const items = alerts.filter(alert=>alert.eventId===event.id).sort((left,right)=>left.at.localeCompare(right.at));
    if (event.status !== 'planned' || !event.date || eventAlertDeadline(event) <= now) return null;
    return <section class="inspector-alerts">
      <header class="inspector-section-heading"><h3>Напоминания</h3><Button kind="text-button" icon="plus" onClick={()=>setDialog({kind:'event-alert',event,returnTo:dialog})}>Добавить</Button></header>
      {items.map(alert=><div class="inspector-alert" key={alert.id}>
        <button class="task-title" type="button" onClick={()=>setDialog({kind:'event-alert',event,alert,returnTo:dialog})}>
          <span>{alert.title}<small>{reminderLabel(alert.at)} · МСК{alert.alarmDevice && ' · Будильник'}</small></span>
        </button>
        <button class="icon-button" type="button" aria-label={`Удалить ${alert.alarmDevice ? 'будильник' : 'напоминание'}: ${alert.title}`} onClick={()=>attempt(()=>commit(removeEventAlert(data,alert.id),alert.alarmDevice ? 'Будильник отменён' : 'Напоминание отменено',undefined,{keepDialog:true}))}><Icon name="close"/></button>
      </div>)}
    </section>;
  };
  const body = view === 'board' ? <TaskBoard data={data} mobile={mobileCalendar} pending={projection.pending} renderPending={event=>pendingCard(event,false,true)}
    onAdd={()=>setDialog({kind:'task'})} onEdit={task=>setDialog({kind:'task',task})} onOpenEvent={openEvent}
    onStatus={taskStatus} onArchive={taskArchive}/> : view === 'schedule' ? Schedule() : view === 'students' ? Students() : view === 'types' ? <TemplateWorkspace mobile={mobileCalendar} key={`${mode}:${templateSession}`} data={data} initialDraft={templateDraft} leaveGuard={templateLeaveGuard} onEditingChange={setTemplateEditing} onSave={commit} onDelete={setDeletion} onArchive={(family,id,archived)=>attempt(()=>commit(setTemplateArchived(data,family,id,archived),archived ? 'Шаблон в архиве' : 'Шаблон возвращён'))}/> : view === 'appearance' ? <AppearanceSettings/> : view === 'guide' ? <GuideView initialChapter={guideChapter}/> : view === 'statistics' ? <StatisticsView data={data} now={now} onGuide={()=>openGuide(4)} onOpen={event=>setDialog({kind:event.archiveKind ? 'archived-event' : 'event-details',event})}/> : view === 'history' ? <JournalView data={data} now={now} pending={projection.pending} renderPending={event=>pendingCard(event,true)} onOpenEvent={event => setDialog({ kind: 'event-details', event })} onOpenTransfer={openEvent} onStatus={statusEvent} onOpenArchived={event=>setDialog({kind:'archived-event',event})} onDeleteArchived={value=>setDeletion({kind:'event-archive',value})}/> : Settings();
  return <SaveErrorContext.Provider value={account.error}><div ref={layoutRef} data-workspace-view={view} class={`layout ${draggingId ? 'is-dragging-event' : ''} ${sidebarCollapsed ? 'sidebar-collapsed' : ''} ${view==='schedule'?'is-calendar-workspace':''} ${view === 'schedule' && mobileCalendar ? 'has-mobile-calendar' : ''}`}><Sidebar cloudConfigured={cloudConfigured} provider={provider} collapsed={sidebarCollapsed} onToggle={toggleSidebar} view={view} onChange={switchView} pending={projection.pending.length} account={account} onSignIn={demoOnly && onPersonal ? onPersonal : signIn} onHome={goHome}/>
    <main class="main"><div class="mobile-workspace-header"><Brand onClick={event=>{event.preventDefault();goHome?.();}}/><div class="mobile-header-actions"><SyncStatus account={account} mode={mode} onSync={workspace.sync}/><button class="mobile-profile" aria-label="Настройки аккаунта" onClick={()=>switchView('settings')}>{account.user?initials(account.user.displayName||account.user.email):'Я'}</button></div></div>{view === 'schedule' && mobileCalendar ?
      <MobileCalendarHeader level={mobileLevel} date={week} onBack={() => showMobilePeriod(mobileLevel === 'day' ? 'month' : 'year')}
        onAdd={() => newEvent()} query={query} onQuery={setQuery} options={<>{calendarOptions}<SyncStatus account={account} mode={mode} onSync={workspace.sync}/></>}/> :
      <header class={`page-header ${view === 'schedule' ? 'calendar-topbar' : ''}`}>{view === 'schedule' ? (<div class="calendar-heading-group"><h1 class="sr-only">Расписание</h1><div class="calendar-period"><h2>{dateLabel(week, { day: rangeView === 'day' ? 'numeric' : undefined, month: 'long', year: 'numeric' })}</h2>{rangeView !== 'month' && range.start.slice(0, 7) !== range.end.slice(0, 7) && <span>{dateLabel(range.start)} — {dateLabel(range.end)}</span>}</div><div class="week-navigation"><button class="icon-button" aria-label="Предыдущий период" onClick={() => navigateWeek(-1)}><Icon name="left"/></button><button class="icon-button" aria-label="Следующий период" onClick={() => navigateWeek(1)}><Icon name="right"/></button></div>
      </div>) : <h1 class="sr-only">{TITLES[view]}</h1>}{view === 'schedule' && <div class="range-switch" role="group" aria-label="Период расписания">{[['day','День'],['week','Неделя'],['month','Месяц']].map(([id,label]) => <button type="button" key={id} aria-pressed={rangeView === id} class={rangeView === id ? 'active' : ''} onClick={() => selectRange(id)}>{label}</button>)}</div>}<div class="header-actions"><SyncStatus account={account} mode={mode} onSync={workspace.sync}/>{view === 'settings' && !account.user && cloudConfigured && <Button disabled={account.loading} onClick={demoOnly && onPersonal ? onPersonal : signIn}>{cloudConfigured ? signInLabel : 'Подключить облако'}</Button>}<button class="icon-button" aria-label="Настройки" onClick={() => switchView('settings')}><Icon name="settings"/></button>{['schedule','students'].includes(view) && <Button kind="primary" icon="plus" onClick={() => view === 'students' ? setDialog({ kind: 'record-choice' }) : newEvent()}>{view === 'students' ? 'Добавить запись' : 'Добавить событие'}</Button>}</div></header>}
    {mode === 'demo' && <div class="demo-banner"><Icon name="info"/><span>Деморасписание с вымышленными данными. Пробуй карточки, поля и переносы.</span><button class="text-button" onClick={() => attempt(() => switchMode('personal'))}>Создать своё <Icon name="arrow"/></button></div>}
    {alarms.error && <div class="account-banner error" role="alert"><span>{alarms.error}</span><Button onClick={alarms.retry}>Повторить</Button></div>}
    {account.error && <div class="account-banner error" role="alert"><span>{account.error}</span><Button onClick={workspace.reconnect}>Подключиться заново</Button></div>}
    {mode === 'cloud' && (!account.online || account.syncError || !account.ready) && !account.conflict && <div class="account-banner sync-conflict">{!account.online ? 'Без интернета. Изменения сохраняются на устройстве.' : account.syncError ? 'Синхронизация приостановлена. Можно продолжать работу на устройстве.' : 'Показана сохранённая копия. Изменения сохраняются на устройстве.'}</div>}
    {mode === 'cloud' && account.conflict && <div class="account-banner sync-conflict">
      <span role="status">{account.conflict.reason === 'overlap' ? 'События с двух устройств пересекаются по времени. Измени время или выбери копию расписания целиком.' : account.conflict.wholeWorkspace ? 'Связанные данные изменились на двух устройствах. Выбери, какую копию расписания сохранить.' : 'Одни и те же данные изменились на двух устройствах. Выбери версию для спорных записей.'} {account.conflict.items.slice(0,3).map(item=>item.label).join(', ')}{account.conflict.items.length>3 ? '…' : ''}</span>
      <div class="sync-conflict-actions">
        <Button disabled={account.syncing || !account.online} onClick={()=>attempt(()=>workspace.sync('local'))}>Моя версия</Button>
        <Button disabled={account.syncing || !account.online} onClick={()=>attempt(()=>workspace.sync('cloud'))}>Версия из облака</Button>
        <Button kind="text-button" onClick={()=>attempt(()=>exportData(mode,workspace.pendingCopy()))}>Скачать мою копию</Button>
      </div>
    </div>}
    {stale && <div class="demo-banner"><span>Расписание изменилось в другой вкладке или на другом устройстве.</span><Button onClick={() => attempt(() => { if (!canLeaveTemplates() || dialog && !confirm('Закрыть редактор и загрузить обновлённое расписание?')) return; workspace.refresh(); resetTemplateWorkspace(); close(); setDeletion(null); setUndo(null); })}>Обновить данные</Button></div>}
    <div class="reminder-inbox" aria-label="Напоминания" aria-live="polite">{activeReminders(data).filter(reminder => Date.parse(reminder.at) <= now).map(reminder => <article class="reminder-notice" key={reminder.id}><div><strong>{reminderMessage(data,reminder).title}</strong><p>Всё ещё ждёт переноса</p></div><Button onClick={()=>openEvent(reminder.eventId)}>Открыть событие</Button><button type="button" class="text-button" onClick={()=>attempt(()=>commit(removeReminder(data,reminder.eventId),'Напоминание убрано'))}>Убрать</button></article>)}
    {alerts.filter(alert=>!alert.alarmDevice && Date.parse(alert.at)<=now && now<eventAlertDeadline(alert)).map(alert=><article class="reminder-notice" key={alert.id}>
      <div><strong>{alert.title}</strong><p>Скоро начнётся событие</p></div>
      <Button onClick={()=>openEvent(alert.eventId)}>Открыть событие</Button>
      <button type="button" class="text-button" onClick={()=>attempt(()=>commit(removeEventAlert(data,alert.id),'Напоминание убрано'))}>Убрать</button>
    </article>)}</div>
    {body}<footer class="page-footer">{mode!=='cloud' && <span>Сохранено в этом браузере</span>}<span>Московское время · UTC+3</span></footer></main></div>
    <TouchMovePicker controller={picker} dragging={Boolean(touch.drag || movePicker?.native)} onHover={setMoveHover} title={picker.drag ? eventTitle(data, picker.drag.item) : ''} onChoose={(event, date) => { cancelMovePicker(); dropTouchEvent(event, date); }}/>
    <PressDragGhost controller={touch} title={touch.drag ? eventTitle(data, touch.drag.item) : ''}/>
    {dialog?.kind === 'event-alert' && <EventAlertEditor key={dialog.alert?.id || dialog.event.id} data={data} {...dialog} now={now}
      onSave={saveSubEditor} onClose={closeSubEditor} alarmDevice={alarms.deviceId} onAuthorizeAlarm={nativeAlarms?.authorize} onEnablePush={pushEnabled ? ()=>provider.notifications.enable(account.user) : undefined}/>}
    {dialog?.kind === 'task' && <TaskEditor data={data} task={dialog.task} source={dialog.source} today={today} now={now} onSave={saveSubEditor} onClose={closeSubEditor}/>}
    {dialog?.kind === 'event-editor' && <EventEditor key={dialog.original?.id || 'new-event'} data={data} {...dialog} onDelete={() => setDeletion({ kind: 'event', value: dialog.original })} onSave={commit} onClose={close} onNewStudent={draft => setDialog({ kind: 'student-editor', returnTo: { ...dialog, draft } })} onNewRecord={(category, draft) => setDialog({ kind: 'record-editor', category, returnTo: { ...dialog, draft } })}/>}
    {dialog?.kind === 'reminder' && <ReminderDialog key={dialog.event.id} data={data} event={dialog.event} now={now} onClose={close} onSave={value=>commit(saveReminder(data,dialog.event.id,value),'Напоминание сохранено')} onRemove={()=>attempt(()=>commit(removeReminder(data,dialog.event.id),'Напоминание убрано'))} pushReady={Boolean(provider?.notifications?.enabled) && mode==='cloud'} onEnablePush={()=>provider.notifications.enable(account.user)}/>}
    {dialog?.kind === 'event-details' && <EventDetails key={dialog.event.id} initialMapExpanded={dialog.showPlace} anchor={dialog.anchor} tasksSection={eventTasks(dialog.event)} alertsSection={eventAlertsSection(dialog.event)} data={data} event={dialog.event} now={now} onRestore={() => returnEvent(dialog.event)} onRemind={() => setDialog({kind:'reminder',event:dialog.event})} onStop={() => setDialog({ kind: 'stop-series', event: dialog.event })} onClose={close} onDelete={() => setDeletion({ kind: 'event', value: dialog.event })} onEdit={() => editEvent(dialog.event)} onMove={() => openMovePicker(dialog.event)} onRecord={record => setDialog({ kind: 'record-details', record })} onStatus={status => statusEvent(dialog.event, status)} onStudent={student => setDialog({ kind: 'student-details', student })}/>}
    {dialog?.kind === 'student-editor' && <StudentEditor data={data} original={dialog.original} onDelete={() => setDeletion({ kind: 'record', value: dialog.original })} onClose={() => dialog.returnTo ? setDialog(dialog.returnTo) : close()} onSave={(next, message, student) => { const returnTo = dialog.returnTo; const finish = ok => { if (!ok) return; if (returnTo) setDialog({ ...returnTo, draft: { ...returnTo.draft, studentId: student.id, recordId: student.id, title: returnTo.draft.title || student.name, color: student.color } }); }; const result = commit(next, message); return result?.then ? result.then(finish) : finish(result); }}/>}
    {dialog?.kind === 'student-details' && <StudentDetails data={data} student={dialog.student} onDelete={() => setDeletion({ kind: 'record', value: dialog.student })} onClose={close} onEdit={() => setDialog({ kind: 'student-editor', original: dialog.student })} onEvent={() => newEvent(selectedDate, dialog.student.id)}/>}
    {dialog?.kind === 'stop-series' && <StopSeriesDialog data={data} event={dialog.event} onSave={commit} onClose={close}/>}
    {dialog?.kind === 'move-editor' && <MoveEditor data={data} event={dialog.event} date={dialog.date} onRestore={() => returnEvent(dialog.event)} onClose={close} onSave={commit} onAdvanced={draft => setDialog({ kind: 'event-editor', original: dialog.event, draft })}/>}
    {dialog?.kind === 'record-choice' && <Modal title="Что добавить?" subtitle="Общие записи можно связывать с разными событиями." onClose={close}><div class="record-choice">{recordKinds(data).map(kind => <Button key={kind} onClick={() => setDialog({ kind: kind === 'student' ? 'student-editor' : 'record-editor', category: kind })}>{RECORD_KINDS[kind] || kind}</Button>)}
      {!recordKinds(data).length && <Button onClick={()=>{setTemplateDraft('records');setView('types');close();}}>Создать шаблон записи</Button>}</div></Modal>}
    {dialog?.kind === 'record-editor' && <RecordEditor data={data} original={dialog.original} onDelete={() => setDeletion({ kind: 'record', value: dialog.original })} category={dialog.category} onClose={() => dialog.returnTo ? setDialog(dialog.returnTo) : close()} onSave={(next, message, record) => { const returnTo = dialog.returnTo; const finish = ok => { if (!ok) return; if (returnTo) setDialog({ ...returnTo, draft: { ...returnTo.draft, recordId: record.id, studentId: '', title: returnTo.draft.title || record.name, color: record.color } }); }; const result = commit(next, message); return result?.then ? result.then(finish) : finish(result); }}/>}
    {dialog?.kind === 'record-details' && <RecordDetails record={dialog.record} onDelete={() => setDeletion({ kind: 'record', value: dialog.record })} onClose={close} onEdit={() => setDialog({ kind: 'record-editor', original: dialog.record })} onEvent={() => newEventForRecord(dialog.record)}/>}
    {dialog?.kind === 'archived-event' && <EventDetails data={data} event={dialog.event} now={now} readOnly onClose={close}/>}
    {deletion && <DeleteDialog data={data} target={deletion} onSave={(next,message,{permanent=false}={})=>commit(next,message,undefined,{canUndo:!permanent})} onClose={() => setDeletion(null)}/>}
    <MobileNav view={view} onChange={switchView} pending={projection.pending.length} onHome={goHome}/>
    {account.saving && <div class="save-shield" role="status" aria-live="polite"><span>Сохраняем изменения…</span></div>}
    {notice && <div id="notice" class="visible" role="status"><span>{notice.text}</span>{notice.canUndo && undo && undo.mode === mode && undo.revision === data.revision && <button class="toast-undo" onClick={() => attempt(() => { if (!canLeaveTemplates()) return; if (undo.revision !== data.revision || undo.mode !== mode) throw new Error('Расписание уже изменилось; это действие больше нельзя отменить.'); const previous = undo.data; const finish = ok => { if (ok) { setUndo(null); if (view === 'types') resetTemplateWorkspace(); } }; const result = commit(previous, 'Последнее изменение отменено'); return result?.then ? result.then(finish) : finish(result); })}>Отменить</button>}</div>}
  </SaveErrorContext.Provider>;
}
