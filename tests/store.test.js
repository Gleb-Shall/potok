import test from 'node:test';
import assert from 'node:assert/strict';
import { createLocalStore } from '../src/lib/legacy-store.js';

const empty = () => ({ students: [], series: [], lessons: [] });
const student = { id: 'one', name: 'Пример', subject: 'Математика', color: 'green', rate: 1000, contact: '', notes: '' };
function memoryStorage() {
  const values = new Map();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
}

test('local student changes survive reopening the application', () => {
  const storage = memoryStorage();
  const store = createLocalStore(storage, 'test', empty());
  store.upsert('students', student);
  const reopened = createLocalStore(storage, 'test', empty());
  assert.equal(reopened.getState().students[0].name, 'Пример');
  reopened.upsert('students', { ...student, name: 'Обновлённое имя' });
  assert.equal(reopened.getState().students.length, 1);
  assert.equal(reopened.getState().students[0].name, 'Обновлённое имя');
});
test('failed storage writes never report a successful mutation', () => {
  const storage = memoryStorage();
  const store = createLocalStore(storage, 'test', empty());
  storage.setItem = () => { throw new Error('QuotaExceededError'); };
  assert.throws(() => store.upsert('students', student), /сохранить/);
  assert.equal(store.getState().students.length, 0);
});
test('corrupted stored data produces an actionable error rather than erasing data', () => {
  const storage = memoryStorage();
  storage.setItem('test', '{broken');
  assert.throws(() => createLocalStore(storage, 'test', empty()), /прочитать/);
  assert.equal(storage.getItem('test'), '{broken');
  storage.setItem('test', JSON.stringify({ students: 'broken' }));
  assert.throws(() => createLocalStore(storage, 'test', empty()), /формат/);
});
test('demo and personal schedules use isolated storage keys', () => {
  const storage = memoryStorage();
  const demo = createLocalStore(storage, 'demo', empty());
  demo.upsert('students', student);
  assert.equal(createLocalStore(storage, 'personal', empty()).getState().students.length, 0);
});
test('external objects cannot mutate stored data and invalid operations are rejected', () => {
  const store = createLocalStore(memoryStorage(), 'test', empty());
  store.upsert('students', student);
  const state = store.getState();
  state.students[0].name = 'Нельзя изменить напрямую';
  assert.equal(store.getState().students[0].name, 'Пример');
  assert.throws(() => store.upsert('invalid', student));
  assert.throws(() => store.upsert('students', { name: 'Нет ID' }));
});
