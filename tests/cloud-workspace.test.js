import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareWorkspace, readWorkspace } from '../src/lib/cloud-workspace.js';
import { emptyData } from '../src/lib/storage.js';
import { eventFields, eventTitle, saveEvent, saveStudent } from '../src/lib/events.js';
import { eventLinks } from '../src/lib/links.js';

test('new account starts with only the student and lesson templates', () => {
  const data = readWorkspace(null);
  assert.equal(data.revision, 0); assert.deepEqual(data.events, []); assert.deepEqual(data.students, []);
  assert.deepEqual(data.types.map(type=>type.id), ['lesson']);
  assert.deepEqual(data.recordTypes.map(type=>type.kind), ['student']);
});
test('starter lessons share student details and keep their own rates and links', () => {
  const data = readWorkspace(null);
  const details = data.recordTypes[0].fields.map(field=>({
    ...field, value: field.type === 'url' ? 'https://t.me/student' : 'Математика',
  }));
  const student = { id:'student-1', name:'Анна', details };
  const withStudent = saveStudent(data,student);
  const lesson = { id:'new', typeId:'lesson', title:student.name, studentId:student.id, recordId:student.id,
    date:'2026-11-09', start:900, duration:60, status:'planned' };
  const firstFields = { rate:1500, call:'https://t.me/call', materials:'https://example.com/lesson' };
  const withFirst = saveEvent(withStudent,{values:{...lesson,fields:firstFields}});
  const withSecond = saveEvent(withFirst,{values:{...lesson,start:1020,fields:{rate:2000}}});
  const [first,second] = withSecond.events;
  assert.equal(eventTitle(withSecond,first), 'Анна');
  assert.deepEqual(eventFields(withSecond,first), {...firstFields,subject:'Математика'});
  assert.deepEqual(eventFields(withSecond,second), {rate:2000,subject:'Математика'});
  assert.deepEqual(eventLinks(data.types[0].fields,first.fields,withSecond.students[0]).map(({label,href})=>[label,href]), [
    ['Созвон','https://t.me/call'],
    ['Урок','https://example.com/lesson'],
    ['Telegram ученика','https://t.me/student'],
  ]);
});
test('cloud snapshot roundtrips custom records, recurrence, deletion and map pins', () => {
  const data = { ...emptyData(), records: [{ id: 'p', name: 'Проект', kind: 'project' }], series: [{ id: 's', excludedDates: ['2026-10-30'] }], events: [{ id: 'e', fields: { choices: ['A', 'B'] }, location: { lat: 59.94, lng: 30.3, label: 'Место' } }] };
  const document = prepareWorkspace(data, 0, null);
  const restored = readWorkspace(document);
  assert.deepEqual(restored, { ...data, revision: 1 });
  assert.equal(JSON.parse(document.payload).revision, undefined);
});
test('concurrent edits reject stale revisions instead of replacing another device', () => {
  const initial = prepareWorkspace(emptyData(), 0, null);
  const next = prepareWorkspace(emptyData(), 1, initial);
  assert.equal(next.revision, 2);
  assert.throws(() => prepareWorkspace(emptyData(), 1, next), /другом устройстве/);
  assert.throws(() => prepareWorkspace(emptyData(), 4, null), /другом устройстве/);
});
test('oversize and malformed cloud documents are rejected with recoverable errors', () => {
  assert.throws(() => prepareWorkspace({ ...emptyData(), events: [{ notes: 'я'.repeat(500000) }] }, 0, null), /слишком большое/);
  assert.throws(() => readWorkspace({ payload: '{}', revision: 1 }), /прочитать/);
  assert.throws(() => readWorkspace({ payload: JSON.stringify(emptyData()), revision: -1 }), /версию/);
});
