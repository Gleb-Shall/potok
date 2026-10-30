import { linkHref } from './links.js';
import { addDays, mondayOf, weekdayOf, validateStudent } from './domain.js';

export const FIELD_TYPES = { text: 'Текст', url: 'Ссылка', textarea: 'Длинный текст', number: 'Число', date: 'Дата', select: 'Один вариант', multiselect: 'Несколько вариантов', checkbox: 'Флажок' };
export const RECORD_KINDS = { student: 'Ученик', person: 'Человек', course: 'Предмет', place: 'Место', project: 'Проект' };
export const recordKind = type => type.recordKind ?? (type.linkStudent ? 'student' : type.id === 'class' ? 'course' : type.id === 'personal' ? 'any' : '');
export const allRecords = data => [...data.students.map(item => ({ ...item, kind: 'student' })), ...(data.records || [])];
export const getRecord = (data, event) => event.snapshot?.record || allRecords(data).find(item => item.id === (event.recordId || event.studentId));
export const COLOR_NAMES = { violet: 'Сиреневый', blue: 'Голубой', green: 'Зелёный', peach: 'Персиковый', pink: 'Розовый' };
const field = (id, label, type = 'text', extra = {}) => ({ id, label, type, required: false, showOnCard: true, archived: false, options: [], ...extra });
export function defaultTypes() {
  return [
    { id: 'lesson', name: 'Урок', titleLabel: 'Название занятия', icon: '✎', color: 'violet', linkStudent: true, requireStudent: true, archived: false, fields: [field('topic', 'Тема'), field('rate', 'Стоимость, ₽', 'number')] },
    { id: 'class', name: 'Пара', titleLabel: 'Предмет', icon: '▤', color: 'blue', linkStudent: false, requireStudent: false, archived: false, fields: [field('teacher', 'Преподаватель'), field('room', 'Аудитория'), field('format', 'Формат', 'select', { options: ['Лекция', 'Семинар', 'Практика', 'Лабораторная'] })] },
    { id: 'personal', name: 'Личное', titleLabel: 'Название события', icon: '◇', color: 'green', linkStudent: false, requireStudent: false, archived: false, fields: [field('location', 'Место'), field('description', 'Описание', 'textarea', { showOnCard: false })] }
  ];
}
export function getType(data, id) { return data.types.find(type => type.id === id) || { id, name: 'Архивный тип', titleLabel: 'Название', icon: '◇', color: 'violet', fields: [] }; }
export const eventType = (data, event) => event.snapshot?.type?.id === event.typeId ? event.snapshot.type : getType(data, event.typeId);
export function snapshotEvent(data, event) {
  const record = getRecord(data, event);
  return { ...structuredClone(event), title: eventTitle(data, event), snapshot: event.snapshot || { type: structuredClone(eventType(data, event)), record: record ? structuredClone(record) : null } };
}
export function getStudent(data, id) { return data.students.find(student => student.id === id); }
export function eventTitle(data, event) { return event.title || getStudent(data, event.studentId)?.name || 'Событие'; }
export function eventColor(data, event) { return event.color || getType(data, event.typeId).color || 'violet'; }
export function eventMatches(data, event, query, typeId = '') {
  const text = [eventTitle(data, event), eventType(data, event).name, getRecord(data, event)?.name, event.location?.label, ...Object.values(event.fields || {})].join(' ').toLocaleLowerCase('ru');
  return (!typeId || event.typeId === typeId) && text.includes(query.toLocaleLowerCase('ru'));
}
export const daysBetween = (from, to) => Math.round((Date.parse(to + 'T00:00:00Z') - Date.parse(from + 'T00:00:00Z')) / 86400000);

export function normalizeData(source) {
  if (source?.version === 2) {
    if (!['students', 'types', 'series', 'events'].every(key => Array.isArray(source[key]))) throw new Error('Неизвестный формат данных. Исходная копия сохранена.');
    if (source.records !== undefined && !Array.isArray(source.records)) throw new Error('Не удалось прочитать общие записи. Исходная копия сохранена.');
    const normalized = { ...structuredClone(source), records: structuredClone(source.records || []) };
    normalized.events = normalized.events.map(event => event.status === 'done' && !event.snapshot ? snapshotEvent(normalized, event) : event);
    return normalized;
  }
  if (!source || !['students', 'series', 'lessons'].every(key => Array.isArray(source[key]))) throw new Error('Не удалось прочитать старое расписание. Исходная копия сохранена.');
  const convert = item => ({ ...item, typeId: 'lesson', title: source.students.find(student => student.id === item.studentId)?.name || 'Урок', fields: { topic: item.notes || '', rate: source.students.find(student => student.id === item.studentId)?.rate || 0 }, color: source.students.find(student => student.id === item.studentId)?.color || 'violet', busy: true });
  return { version: 2, students: structuredClone(source.students), records: [], types: defaultTypes(), series: source.series.map(item => ({ ...convert(item), intervalWeeks: 1 })), events: source.lessons.map(convert) };
}

export function seriesOccurs(series, date) {
  const firstOffset = (series.weekday - weekdayOf(series.from) + 7) % 7;
  return !series.archived && !(series.excludedDates || []).includes(date) && date >= series.from && (!series.until || date <= series.until) && weekdayOf(date) === series.weekday && (daysBetween(series.from, date) - firstOffset) % ((series.intervalWeeks || 1) * 7) === 0;
}
function occurrence(series, date) {
  const { from, until, weekday, intervalWeeks, archived, excludedDates, id, ...details } = series;
  return { ...details, id: `${id}:${date}`, seriesId: id, anchorDate: date, date, status: 'planned', history: [] };
}
export function projectWeek(data, start, dayCount = 7) {
  const end = addDays(start, dayCount - 1);
  const inWeek = date => date && date >= start && date <= end;
  const stored = new Map(data.events.map(event => [event.id, event]));
  const all = new Map();
  for (const series of data.series) {
    for (let day = 0; day < dayCount; day++) {
      const date = addDays(start, day);
      if (seriesOccurs(series, date)) { const item = occurrence(series, date); all.set(item.id, stored.get(item.id) || item); }
    }
  }
  for (const event of data.events) all.set(event.id, event);
  const events = [], ghosts = [], pending = [];
  for (const event of all.values()) {
    if (event.status === 'pending') pending.push(event);
    else if (event.status !== 'cancelled' && inWeek(event.date)) events.push(event);
    const origin = event.originalDate || event.anchorDate || event.date;
    const changed = event.date !== origin || event.start !== (event.originalStart ?? event.start) || event.status === 'pending' || event.status === 'cancelled';
    if (changed && inWeek(origin)) ghosts.push({ ...event, ghost: true, destinationDate: event.date, destinationStart: event.start, date: origin, start: event.originalStart ?? event.start });
  }
  const sorted = list => list.sort((a, b) => (a.date || '').localeCompare(b.date || '') || a.start - b.start);
  return { events: sorted(events), ghosts: sorted(ghosts), pending };
}
export function moveEvent(event, date, start, duration) {
  const changed = date !== event.date || start !== event.start || duration !== event.duration;
  if (!changed) return { ...event };
  return { ...event, date, start, duration, originalDate: event.originalDate || event.anchorDate || event.date,
    originalStart: event.originalStart ?? event.start, originalDuration: event.originalDuration ?? event.duration,
    status: date === null ? 'pending' : 'planned', history: [...(event.history || []), { fromDate: event.date, fromStart: event.start, toDate: date, toStart: start, at: new Date().toISOString() }] };
}
export function validateEvent(data, input) {
  if (!input.title?.trim() || input.title.length > 200) throw new Error('Укажи название до 200 символов.');
  addDays(input.date, 0);
  if (!Number.isInteger(input.start) || !Number.isInteger(input.duration) || input.start < 0 || input.duration < 5 || input.start + input.duration > 1440) throw new Error('Событие должно длиться не меньше 5 минут и закончиться в тот же день.');
  const type = data.types.find(item => item.id === input.typeId);
  if (!type) throw new Error('Выбери существующий тип события.');
  if (type.requireStudent && !input.recordDetached && !data.students.some(student => student.id === input.studentId)) throw new Error('Для этого типа нужен ученик. Сначала добавь его в разделе «Записи».');
  const linked = getRecord(data, input);
  const kind = recordKind(type);
  if (type.requireRecord && !input.recordDetached && !linked) throw new Error('Выбери связанную запись.');
  if (linked && kind && kind !== 'any' && linked.kind !== kind) throw new Error('Связанная запись не подходит этому типу события.');
  if (input.location && (!Number.isFinite(input.location.lat) || !Number.isFinite(input.location.lng) || Math.abs(input.location.lat) > 90 || Math.abs(input.location.lng) > 180)) throw new Error('Выбери корректную точку на карте.');
  if ((input.notes || '').length > 5000) throw new Error('Заметка слишком длинная.');
  for (const field of type.fields.filter(item => !item.archived)) {
    const value = input.fields[field.id];
    if (field.required && (value == null || value === '' || Array.isArray(value) && !value.length || (field.type === 'checkbox' && value !== true))) throw new Error(`Заполни поле «${field.label}».`);
    if (value !== '' && value != null && field.type === 'number' && !Number.isFinite(Number(value))) throw new Error(`В поле «${field.label}» нужно число.`);
    if (value && field.type === 'url' && !linkHref(value)) throw new Error(`В поле «${field.label}» нужна ссылка http:// или https://.`);
    if (value && field.type === 'date') addDays(value, 0);
    const previous = data.events.find(event => event.id === input.id) || data.series.find(series => series.id === input.seriesId);
    if (value && field.type === 'select' && !field.options.includes(value) && previous?.fields?.[field.id] !== value) throw new Error(`Выбери значение поля «${field.label}» из списка.`);
    if (field.type === 'multiselect' && value != null && (!Array.isArray(value) || value.some(item => !field.options.includes(item) && !previous?.fields?.[field.id]?.includes(item)))) throw new Error(`Выбери варианты поля «${field.label}» из списка.`);
  }
  return { ...input, title: input.title.trim() };
}
function overlaps(a, b) { return a.id !== b.id && a.busy !== false && b.busy !== false && a.start < b.start + b.duration && a.start + a.duration > b.start; }
export function assertNoConflict(data, event, repeat = null) {
  if (event.busy === false) return;
  const current = projectWeek(data, mondayOf(event.date)).events.find(item => item.date === event.date && overlaps(event, item));
  if (current) throw new Error(`Пересечение с событием «${eventTitle(data, current)}». Измени время или отключи «Занимает время».`);
  if (!repeat) return;
  const proposed = { ...event, from: event.date, until: repeat.until, intervalWeeks: repeat.intervalWeeks, weekday: weekdayOf(event.date) };
  for (const item of data.events) {
    if (item.date && !['pending', 'cancelled'].includes(item.status) && seriesOccurs(proposed, item.date) && overlaps(event, item)) throw new Error(`Будущее пересечение с событием «${eventTitle(data, item)}» (${item.date}).`);
  }
  for (const series of data.series) {
    if (series.archived || !overlaps(event, series) || series.weekday !== proposed.weekday) continue;
    // Intervals are limited to 12 weeks; their least common cycle fits in 132 weeks.
    const jump = Math.max(0, Math.ceil(daysBetween(event.date, series.from) / (proposed.intervalWeeks * 7)));
    let date = addDays(event.date, jump * proposed.intervalWeeks * 7);
    for (let index = 0; index <= 132; index++, date = addDays(date, proposed.intervalWeeks * 7)) {
      if (proposed.until && date > proposed.until || series.until && date > series.until) break;
      if (seriesOccurs(series, date)) throw new Error(`Постоянное время пересекается с «${series.title || 'Событие'}».`);
    }
  }
}
const upsert = (items, record) => [...items.filter(item => item.id !== record.id), record];
function makeSeries(event, repeat, id = crypto.randomUUID()) {
  const { date, seriesId, anchorDate, history, originalDate, originalStart, originalDuration, status, ghost, destinationDate, destinationStart, snapshot, completedAt, endedAt, ...details } = event;
  return { ...details, id, from: date, until: repeat.until, intervalWeeks: repeat.intervalWeeks, weekday: weekdayOf(date) };
}
export function saveEvent(data, { values, original = null, repeat = null, scope = 'one' }) {
  const event = validateEvent(data, values);
  const next = structuredClone(data);
  if (repeat) {
    if (!Number.isInteger(repeat.intervalWeeks) || repeat.intervalWeeks < 1 || repeat.intervalWeeks > 12) throw new Error('Повтор — каждые 1–12 недель.');
    if (repeat.until) { addDays(repeat.until, 0); if (repeat.until < event.date) throw new Error('Конец повторов должен быть после первого события.'); }
  }
  if (original?.seriesId && scope === 'future') {
    const previous = next.series.find(item => item.id === original.seriesId);
    if (!previous) throw new Error('Постоянное расписание не найдено.');
    const splitDate = original.anchorDate;
    const newId = crypto.randomUUID();
    previous.until = addDays(splitDate, -1);
    if (splitDate <= previous.from) previous.archived = true;
    const futureExceptions = next.events.filter(item => item.seriesId === previous.id && item.anchorDate >= splitDate && item.id !== original.id);
    const futureExcluded = (previous.excludedDates || []).filter(date => date >= splitDate);
    previous.excludedDates = (previous.excludedDates || []).filter(date => date < splitDate);
    next.events = next.events.filter(item => !(item.seriesId === previous.id && item.anchorDate >= splitDate));
    const newRepeat = repeat || { intervalWeeks: previous.intervalWeeks || 1, until: '' };
    for (const item of futureExceptions) {
      const ordinal = Math.round(daysBetween(splitDate, item.anchorDate) / ((previous.intervalWeeks || 1) * 7));
      const newAnchor = addDays(event.date, ordinal * newRepeat.intervalWeeks * 7);
      next.events.push({ ...item, id: `${newId}:${newAnchor}`, seriesId: newId, anchorDate: newAnchor, originalDate: item.originalDate || item.anchorDate, originalStart: item.originalStart ?? item.start });
    }
    assertNoConflict({ ...next, events: next.events.filter(item => item.seriesId !== newId) }, event, newRepeat);
    const replacement = makeSeries(event, newRepeat, newId);
    replacement.excludedDates = futureExcluded.map(date => addDays(event.date, Math.round(daysBetween(splitDate, date) / ((previous.intervalWeeks || 1) * 7)) * newRepeat.intervalWeeks * 7));
    next.series.push(replacement);
    const edited = moveEvent(original, event.date, event.start, event.duration);
    if (edited.history?.length) next.events.push({ ...edited, ...event, id: `${newId}:${event.date}`, seriesId: newId, anchorDate: event.date, history: edited.history, originalDate: edited.originalDate, originalStart: edited.originalStart, originalDuration: edited.originalDuration });
    return next;
  }
  if (original?.seriesId || original && !repeat) {
    assertNoConflict(next, event);
    const moved = moveEvent(original, event.date, event.start, event.duration);
    next.events = upsert(next.events, { ...moved, ...event, history: moved.history, originalDate: moved.originalDate, originalStart: moved.originalStart, originalDuration: moved.originalDuration });
  } else if (repeat) {
    if (original) next.events = next.events.filter(item => item.id !== original.id);
    assertNoConflict(next, event, repeat);
    next.series.push(makeSeries(event, repeat));
  } else {
    assertNoConflict(next, event);
    next.events = upsert(next.events, { ...event, id: crypto.randomUUID(), seriesId: '', anchorDate: event.date, status: 'planned', history: [] });
  }
  return next;
}
export function validateRecordDetails(details = []) {
  const kept = details.filter(item => String(item.label || '').trim() || String(item.value || '').trim());
  for (const item of kept) {
    if (!item.label?.trim()) throw new Error('Дай название каждому сведению.');
    if (item.type === 'url' && item.value && !linkHref(item.value)) throw new Error(`В поле «${item.label}» нужна ссылка http:// или https://.`);
  }
  return kept;
}
export function saveStudent(data, student) { return { ...data, students: upsert(data.students, { ...validateStudent(student), details: validateRecordDetails(student.details) }) }; }
export function saveRecord(data, input) {
  if (!input.name?.trim() || input.name.length > 200) throw new Error('Укажи название до 200 символов.');
  if (!input.kind?.trim() || input.kind.length > 80 || input.kind === 'student') throw new Error('Укажи категорию записи. Для ученика используй карточку ученика.');
  const original = (data.records || []).find(item => item.id === input.id);
  if (original && original.kind !== input.kind && [...data.events, ...data.series].some(item => item.recordId === input.id)) throw new Error('У записи уже есть события. Сохрани её категорию или создай новую запись.');
  const record = { ...input, name: input.name.trim(), kind: input.kind.trim(), details: validateRecordDetails(input.details) };
  if (record.details.some(item => !item.label.trim())) throw new Error('Дай название каждому сведению.');
  return { ...data, records: upsert(data.records || [], record) };
}
export function saveType(data, input) {
  if (!input.name.trim() || input.name.length > 80) throw new Error('Укажи название типа до 80 символов.');
  if (data.types.some(type => type.id !== input.id && type.name.toLocaleLowerCase('ru') === input.name.trim().toLocaleLowerCase('ru'))) throw new Error('Тип с таким названием уже существует.');
  for (const field of input.fields) {
    if (!field.label.trim()) throw new Error('У каждого поля должно быть название.');
    if (['select', 'multiselect'].includes(field.type) && !field.archived && !field.options.length) throw new Error(`Добавь варианты для поля «${field.label}».`);
  }
  const type = { ...input, name: input.name.trim(), version: (input.version || 0) + 1 };
  return { ...data, types: upsert(data.types, type) };
}
export function fieldDisplay(field, value) {
  if (value === undefined || value === null || value === '') return '';
  return field.type === 'checkbox' ? value ? 'Да' : 'Нет' : Array.isArray(value) ? value.join(' · ') : String(value);
}

export function calendarRange(anchor, view) {
  const first = anchor.slice(0, 7) + '-01';
  const nextMonth = new Date(first + 'T00:00:00Z');
  nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);
  const start = view === 'month' ? mondayOf(first) : mondayOf(anchor);
  const count = view === 'month' ? Math.ceil(daysBetween(start, nextMonth.toISOString().slice(0, 10)) / 7) * 7 : view === 'fortnight' ? 14 : 7;
  return { start, count, end: addDays(start, count - 1) };
}

export function saveMove(data, event, date, start) {
  addDays(date, 0);
  if (!Number.isInteger(start) || start < 0 || start + event.duration > 1440) throw new Error('Событие должно закончиться в тот же день.');
  const moved = moveEvent(event, date, start, event.duration);
  assertNoConflict(data, moved);
  return { ...data, events: upsert(data.events, moved) };
}

export function deleteEvent(data, event, scope = 'one') {
  const next = structuredClone(data);
  if (event.seriesId && scope === 'all') {
    next.series = next.series.filter(item => item.id !== event.seriesId);
    next.events = next.events.filter(item => item.seriesId !== event.seriesId && item.id !== event.id);
  } else {
    next.events = next.events.filter(item => item.id !== event.id);
    const series = next.series.find(item => item.id === event.seriesId);
    if (series && event.anchorDate) series.excludedDates = [...new Set([...(series.excludedDates || []), event.anchorDate])];
  }
  return next;
}

export function deleteRecord(data, record, removeEvents = false) {
  const next = structuredClone(data);
  const linked = event => event.recordId === record.id || event.studentId === record.id;
  if (removeEvents) {
    const seriesIds = new Set(next.series.filter(linked).map(item => item.id));
    next.series = next.series.filter(item => !seriesIds.has(item.id));
    next.events = next.events.filter(item => !linked(item) && !seriesIds.has(item.seriesId));
  } else {
    const detach = item => linked(item) ? { ...item, title: item.title || record.name, recordId: '', studentId: '', recordDetached: true } : item;
    next.series = next.series.map(detach); next.events = next.events.map(detach);
  }
  next.students = next.students.filter(item => item.id !== record.id);
  next.records = (next.records || []).filter(item => item.id !== record.id);
  return next;
}

export function deleteType(data, id) {
  const next = structuredClone(data);
  const seriesIds = new Set(next.series.filter(item => item.typeId === id).map(item => item.id));
  next.series = next.series.filter(item => !seriesIds.has(item.id));
  next.events = next.events.filter(item => item.typeId !== id && !seriesIds.has(item.seriesId));
  next.types = next.types.filter(item => item.id !== id);
  return next;
}
