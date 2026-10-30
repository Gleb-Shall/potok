import { addDays, todayISO } from './domain.js';
import { snapshotEvent, projectWeek } from './events.js';
export { snapshotEvent } from './events.js';

export function eventHasEnded(event, now = Date.now()) {
  if (!event.date || event.status === 'pending') return false;
  const end = Date.parse(`${event.date}T00:00:00+03:00`) + (Number(event.start) + Number(event.duration)) * 60000;
  return Number.isFinite(end) && end <= Number(now);
}
export function setEventStatus(data, event, status, now = Date.now()) {
  let next = { ...event, status };
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
    const historical = item.status === 'done' || eventHasEnded(item, now);
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
  const candidates = [...projection.events, ...data.events.filter(item => item.status === 'cancelled' && item.date >= start && item.date < end.toISOString().slice(0, 10))];
  return candidates.filter(item => (item.status === 'done' || eventHasEnded(item, now)) &&
    (status === 'all' || status === 'done' && item.status === 'done' || status === 'unconfirmed' && item.status === 'planned' || status === 'cancelled' && item.status === 'cancelled'))
    .sort((a, b) => b.date.localeCompare(a.date) || b.start - a.start);
}
