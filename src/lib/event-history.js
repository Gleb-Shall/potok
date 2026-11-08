import { addDays, todayISO } from './domain.js';
import { snapshotEvent, projectWeek, recurringEventsThrough } from './events.js';
export { snapshotEvent } from './events.js';

export function eventHasEnded(event, now = Date.now()) {
  if (!event.date || event.status === 'pending') return false;
  const end = Date.parse(`${event.date}T00:00:00+03:00`) + (Number(event.start) + Number(event.duration)) * 60000;
  return Number.isFinite(end) && end <= Number(now);
}
export const awaitsConfirmation = (event, now) => event.status === 'planned' && eventHasEnded(event, now);
export function eventState(event, now) {
  if (event.status === 'done') return 'confirmed';
  if (event.status === 'cancelled' || event.status === 'pending') return event.status;
  return awaitsConfirmation(event, now) ? 'elapsed' : 'planned';
}

export function previousEventSlot(event) {
  const last = event.history?.at(-1);
  if (last?.toDate === null && last.fromDate) return {date:last.fromDate,start:last.fromStart,duration:event.duration};
  const date = event.originalDate || event.anchorDate;
  return date ? {date,start:event.originalStart ?? event.start,duration:event.originalDuration ?? event.duration} : null;
}
const newestFirst = (a,b) => b.date.localeCompare(a.date) || b.start - a.start;

export function unconfirmedEvents(data, now = Date.now()) {
  const saved = new Set(data.events.map(event => event.id));
  const result = data.events.filter(event => awaitsConfirmation(event, now));
  for (const event of recurringEventsThrough(data.series, todayISO(new Date(now)))) {
    if (!saved.has(event.id) && awaitsConfirmation(event, now)) result.push(event);
  }
  return result.sort(newestFirst);
}
export function setEventStatus(data, event, status, now = Date.now()) {
  let next = { ...event, status };
  if (status === 'cancelled' && !event.date) next = { ...next, ...previousEventSlot(event) };
  if (status === 'done') next = { ...snapshotEvent(data, next), completedAt: new Date(now).toISOString() };
  else if (event.status === 'done') { delete next.completedAt; delete next.snapshot; }
  return { ...data, events: [...data.events.filter(item => item.id !== event.id), next] };
}

export function stopSeries(data, event, cutoff = todayISO(), now = Date.now()) {
  addDays(cutoff, 0);
  const today = todayISO(new Date(now));
  if (cutoff < today) throw new Error('Выбери сегодняшний или будущий день. Прошлое расписание сохраняется.');
  const original = data.series.find(item => item.id === event.seriesId);
  if (!original) throw new Error('Повторяющееся расписание не найдено.');
  const next = structuredClone(data);
  const series = next.series.find(item => item.id === original.id);
  // Keep the series itself: it remains the durable source for all older repeats.
  series.until = original.until && original.until < cutoff ? original.until : addDays(cutoff, -1);
  series.endedAt = new Date(now).toISOString();
  const frozen = snapshotEvent(data, { ...original, seriesId: original.id });
  series.snapshot = frozen.snapshot;
  series.title = frozen.title;
  // A lesson earlier today must survive stopping all new repeats from today.
  const earlierToday = projectWeek(data, today, 1).events.filter(item => item.seriesId === original.id && eventHasEnded(item, now));
  const kept = [];
  const excluded = new Set(series.excludedDates || []);
  for (const item of next.events) {
    if (item.seriesId !== original.id) { kept.push(item); continue; }
    const historical = ['done','cancelled'].includes(item.status) || eventHasEnded(item, now);
    const beforeCutoff = (item.date || item.anchorDate) < cutoff;
    if (historical || beforeCutoff) kept.push(historical ? snapshotEvent(data, item) : item);
    else if (item.anchorDate) excluded.add(item.anchorDate);
  }
  for (const item of earlierToday) if (!kept.some(saved => saved.id === item.id)) kept.push(snapshotEvent(data, item));
  series.excludedDates = [...excluded];
  next.events = kept;
  return next;
}

export function historyEvents(data, month, status = 'all', now = Date.now()) {
  const start = month + '-01'; addDays(start, 0);
  const end = new Date(start + 'T00:00:00Z'); end.setUTCMonth(end.getUTCMonth() + 1);
  const count = Math.round((end - Date.parse(start + 'T00:00:00Z')) / 86400000);
  const projection = projectWeek(data, start, count);
  // Cancelled exceptions are not live calendar cards, but still belong in history.
  const endDate = end.toISOString().slice(0, 10);
  const cancelled = data.events.filter(item => item.status === 'cancelled').map(item => item.date ? item : {...item,...previousEventSlot(item)})
    .filter(item => item.date >= start && item.date < endDate);
  const stateFilter = {done:'confirmed',unconfirmed:'elapsed',cancelled:'cancelled'}[status];
  return [...projection.events, ...cancelled].filter(item => {
    const state = eventState(item, now);
    return stateFilter ? state === stateFilter : status === 'all' && ['confirmed','cancelled','elapsed'].includes(state);
  })
    .sort(newestFirst);
}
