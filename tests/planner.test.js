import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultTypes, projectWeek, deleteEvent, deleteRecord, deleteType, saveEvent, saveMove } from '../src/lib/events.js';
import { eventEnd, updateTiming } from '../src/lib/timing.js';

const student = { id: 'student', name: 'Тестовый ученик', color: 'violet' };
const once = extra => ({ id: 'once', typeId: 'lesson', title: 'Урок', studentId: 'student', fields: {}, date: '2026-10-30', anchorDate: '2026-10-30', start: 600, duration: 60, status: 'planned', history: [], ...extra });
const base = () => ({ version: 2, students: [student], records: [], types: defaultTypes(), events: [once()], series: [] });
const recurring = () => ({ ...base(), events: [], series: [{ id: 'weekly', typeId: 'lesson', title: 'Повтор', studentId: 'student', fields: {}, from: '2026-10-26', weekday: 5, intervalWeeks: 1, start: 600, duration: 60 }] });

test('duration and end time update in both directions and handle midnight', () => {
  const timing = { start: '17:00', duration: 60, end: '18:00' };
  assert.deepEqual(updateTiming(timing, 'duration', '90'), { duration: '90', end: '18:30' });
  assert.deepEqual(updateTiming(timing, 'end', '18:45'), { end: '18:45', duration: 105 });
  assert.deepEqual(updateTiming(timing, 'start', '18:00'), { start: '18:00', end: '19:00' });
  assert.equal(eventEnd('23:30', 30), '00:00');
  assert.equal(updateTiming({ start: '23:30' }, 'end', '00:00').duration, 30);
  assert.equal(updateTiming({ start: '00:00' }, 'end', '00:00').duration, 1440);
  assert.equal(eventEnd('23:30', 60), '');
  assert.equal(updateTiming(timing, 'end', '16:00').duration, -60);
  assert.equal(eventEnd('', 60), '');
});
test('permanent deletion removes a one-off event and its ghost/history', () => {
  const data = base(); data.events[0].originalDate = '2026-10-29';
  const next = deleteEvent(data, data.events[0]);
  assert.equal(next.events.length, 0); assert.equal(data.events.length, 1);
  assert.equal(projectWeek(next, '2026-10-26').ghosts.length, 0);
});
test('deleting one repeat removes its moved exception and does not regenerate it after reopening', () => {
  let data = recurring(); const occurrence = projectWeek(data, '2026-10-26').events[0];
  data = saveMove(data, occurrence, '2026-11-01', 660);
  const next = JSON.parse(JSON.stringify(deleteEvent(data, data.events[0])));
  assert.equal(next.events.length, 0);
  assert.equal(projectWeek(next, '2026-10-26').events.length, 0);
  assert.equal(projectWeek(next, '2026-10-26').ghosts.length, 0);
  assert.equal(projectWeek(next, '2026-11-02').events.length, 1);
});
test('deleting a whole series also removes moved and pending exceptions', () => {
  const data = recurring(); const occurrence = projectWeek(data, '2026-10-26').events[0];
  const moved = saveMove(data, occurrence, '2026-11-01', 660);
  const next = deleteEvent(moved, moved.events[0], 'all');
  assert.equal(next.series.length, 0); assert.equal(next.events.length, 0);
});
test('deleted future repeats stay deleted when the later schedule is edited', () => {
  let data = recurring(); const later = projectWeek(data, '2026-11-09').events[0];
  data = deleteEvent(data, later);
  const current = projectWeek(data, '2026-11-02').events[0];
  const edited = saveEvent(data, { original: current, values: { ...current, start: 660 }, scope: 'future', repeat: { intervalWeeks: 1, until: '' } });
  assert.equal(projectWeek(edited, '2026-11-09').events.length, 0);
  assert.equal(projectWeek(edited, '2026-11-16').events[0].start, 660);
});
test('deleting a student can keep independently editable events and recurring slots', () => {
  const data = base(); const kept = deleteRecord(data, student);
  assert.equal(kept.students.length, 0); assert.equal(kept.events.length, 1);
  assert.equal(kept.events[0].studentId, ''); assert.equal(kept.events[0].recordDetached, true);
  assert.doesNotThrow(() => saveEvent(kept, { original: kept.events[0], values: { ...kept.events[0], start: 660 } }));
  assert.equal(deleteRecord(recurring(), student).series[0].recordDetached, true);
});
test('record and template cascades remove only their dependent events and series', () => {
  const data = recurring(); data.events.push(once(), once({ id: 'other', typeId: 'personal', studentId: '', start: 800 }));
  const recordRemoved = deleteRecord(data, student, true);
  assert.equal(recordRemoved.series.length, 0); assert.deepEqual(recordRemoved.events.map(item => item.id), ['other']);
  const typeRemoved = deleteType(data, 'lesson');
  assert.equal(typeRemoved.types.some(item => item.id === 'lesson'), false);
  assert.equal(typeRemoved.students.length, 1); assert.deepEqual(typeRemoved.events.map(item => item.id), ['other']);
});
