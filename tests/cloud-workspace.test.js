import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareWorkspace, readWorkspace } from '../src/lib/cloud-workspace.js';
import { emptyData } from '../src/lib/storage.js';

test('new account starts empty and never inherits demo events', () => {
  const data = readWorkspace(null);
  assert.equal(data.revision, 0); assert.deepEqual(data.events, []); assert.deepEqual(data.students, []);
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
