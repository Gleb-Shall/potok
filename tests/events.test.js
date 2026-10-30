import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultTypes, calendarRange, projectWeek, saveMove, moveEvent, saveEvent, validateEvent, saveRecord, getRecord, normalizeData, fieldDisplay } from '../src/lib/events.js';
import { persistData, loadData } from '../src/lib/storage.js';

const base = () => ({ version: 2, revision: 0, students: [], records: [], types: defaultTypes(), series: [], events: [] });
const event = (extra = {}) => ({ id: 'once', typeId: 'class', title: 'Тестовая пара', date: '2026-10-30', anchorDate: '2026-10-30', start: 600, duration: 90, fields: {}, status: 'planned', busy: true, history: [], ...extra });
const recurring = () => ({ ...base(), series: [{ ...event(), id: 'weekly', date: undefined, from: '2026-10-26', until: '', weekday: 5, intervalWeeks: 1 }] });

test('calendar ranges include full weeks across years and leap months', () => {
  assert.deepEqual(calendarRange('2026-10-30', 'fortnight'), { start: '2026-10-26', count: 14, end: '2026-11-08' });
  assert.deepEqual(calendarRange('2026-11-15', 'month'), { start: '2026-10-26', count: 42, end: '2026-12-06' });
  assert.deepEqual(calendarRange('2027-02-01', 'month'), { start: '2027-02-01', count: 28, end: '2027-02-28' });
  const leap = calendarRange('2028-02-29', 'month');
  assert.ok(leap.start <= '2028-02-29' && leap.end >= '2028-02-29');
  assert.equal(calendarRange('2027-01-01', 'week').start, '2026-12-28');
});
test('quick transfer changes one occurrence and preserves all other repeats, data and original history', () => {
  const data = recurring();
  const initial = projectWeek(data, '2026-10-26', 14).events[0];
  initial.location = { lat: 59.94, lng: 30.3, label: 'Корпус' };
  const next = saveMove(data, initial, '2026-11-03', 720);
  const projection = projectWeek(next, '2026-10-26', 14);
  assert.equal(projection.events.length, 2);
  assert.equal(projection.events.find(item => item.id === initial.id).date, '2026-11-03');
  assert.equal(projection.events.find(item => item.date === '2026-11-06').start, 600);
  assert.equal(projection.ghosts[0].date, '2026-10-30');
  assert.equal(next.events[0].duration, 90);
  assert.equal(next.events[0].location.label, 'Корпус');
  const again = saveMove(next, next.events[0], '2026-11-04', 780);
  assert.equal(again.events[0].originalDate, '2026-10-30');
  assert.equal(again.events[0].history.length, 2);
  assert.equal(data.events.length, 0);
});
test('quick transfer rejects overlap and midnight overflow but allows adjacent and nonblocking events', () => {
  const data = { ...base(), events: [event({ id: 'occupied', date: '2026-11-01', start: 720 })] };
  assert.throws(() => saveMove(data, event(), '2026-11-01', 750), /Пересечение/);
  assert.doesNotThrow(() => saveMove(data, event(), '2026-11-01', 810));
  assert.doesNotThrow(() => saveMove(data, event({ busy: false }), '2026-11-01', 750));
  assert.throws(() => saveMove(data, event(), '2026-11-01', 1400));
});
test('pending occurrence is listed once in a month and can be scheduled again', () => {
  const data = recurring(); const original = projectWeek(data, '2026-10-26').events[0];
  data.events = [moveEvent(original, null, original.start, original.duration)];
  const month = projectWeek(data, '2026-10-26', 42);
  assert.equal(month.pending.length, 1);
  assert.equal(month.ghosts.length, 1);
  assert.equal(month.events.filter(item => item.id === original.id).length, 0);
  const next = saveMove(data, data.events[0], '2026-11-02', 660);
  assert.equal(projectWeek(next, '2026-10-26', 42).pending.length, 0);
  assert.equal(next.events[0].status, 'planned');
});
test('multi-choice requires at least one option and retains removed previously selected values', () => {
  const data = base();
  data.types[1].fields.push({ id: 'tools', label: 'Материалы', type: 'multiselect', required: true, options: ['Учебник', 'Тетрадь'] });
  assert.throws(() => validateEvent(data, event({ fields: { tools: [] } })), /Материалы/);
  assert.throws(() => validateEvent(data, event({ fields: { tools: ['Неизвестное'] } })), /Материалы/);
  assert.doesNotThrow(() => validateEvent(data, event({ fields: { tools: ['Учебник', 'Тетрадь'] } })));
  data.events = [event({ fields: { tools: ['Удалённое', 'Учебник'] } })];
  assert.doesNotThrow(() => validateEvent(data, data.events[0]));
  assert.equal(fieldDisplay({ type: 'multiselect' }, ['Учебник', 'Тетрадь']), 'Учебник · Тетрадь');
});
test('one reusable course record can link to multiple events and is required only when configured', () => {
  let data = saveRecord(base(), { id: 'course', kind: 'course', name: 'Матан', details: [{ label: 'Кафедра', value: 'Анализ' }] });
  data.types[1].recordKind = 'course'; data.types[1].requireRecord = true;
  assert.throws(() => validateEvent(data, event()), /запись/);
  data = saveEvent(data, { values: event({ recordId: 'course' }) });
  data = saveEvent(data, { values: event({ date: '2026-11-02', recordId: 'course' }) });
  assert.equal(data.records.length, 1);
  assert.equal(data.events.length, 2);
  assert.equal(getRecord(data, data.events[1]).name, 'Матан');
  const wrongKind = saveRecord(data, { id: 'person', kind: 'person', name: 'Преподаватель', details: [] });
  assert.throws(() => validateEvent(wrongKind, event({ recordId: 'person' })), /не подходит/);
});
test('map location survives editing, recurrence projection, export-format round trip and browser persistence', () => {
  const location = { lat: 59.94, lng: 30.3, label: 'Учебный корпус', address: 'Санкт-Петербург' };
  let data = saveEvent(base(), { values: event({ location }), repeat: { intervalWeeks: 2, until: '' } });
  assert.equal(projectWeek(data, '2026-10-26', 28).events.length, 2);
  assert.deepEqual(projectWeek(data, '2026-10-26', 28).events[1].location, location);
  data = normalizeData(JSON.parse(JSON.stringify(data)));
  const store = new Map();
  globalThis.localStorage = { getItem: key => store.get(key) ?? null, setItem: (key, value) => store.set(key, value) };
  const saved = persistData('personal', data, 0);
  assert.deepEqual(loadData('personal').series[0].location, location);
  assert.equal(saved.revision, 1);
  assert.throws(() => persistData('personal', data, 0), /другой вкладке/);
  assert.throws(() => validateEvent(data, event({ location: { ...location, lat: 95 } })), /точку/);
});
test('editing current and future repeats keeps past events and moved exceptions', () => {
  let data = recurring();
  const original = projectWeek(data, '2026-11-02').events[0];
  const later = projectWeek(data, '2026-11-09').events[0];
  data = saveMove(data, later, '2026-11-15', 900);
  const edited = saveEvent(data, { original, values: { ...original, title: 'Новый предмет', start: 660 }, scope: 'future', repeat: { intervalWeeks: 1, until: '' } });
  assert.equal(projectWeek(edited, '2026-10-26').events[0].start, 600);
  assert.equal(projectWeek(edited, '2026-11-02').events[0].start, 660);
  assert.equal(projectWeek(edited, '2026-11-09').events[0].date, '2026-11-15');
  assert.equal(projectWeek(edited, '2026-11-09').events[0].start, 900);
});
