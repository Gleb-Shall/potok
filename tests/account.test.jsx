import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { App } from '../src/App.jsx';
import { defaultTypes } from '../src/lib/events.js';
const connection = vi.hoisted(() => ({ onAuth: vi.fn(), signIn: vi.fn(), signOut: vi.fn(), subscribe: vi.fn(), save: vi.fn() }));
vi.mock('../src/lib/firebase-client.js', () => ({ connectFirebase: vi.fn(async () => connection), explainFirebaseError: e => e.message }));
let root, auth, snapshot;
const empty = () => ({ version: 2, revision: 0, students: [], records: [], types: defaultTypes(), series: [], events: [] });
const click = async text => { const button = [...root.querySelectorAll('button')].find(b => b.textContent.includes(text)); expect(button).toBeTruthy(); await act(() => button.click()); };
beforeEach(async () => {
 vi.clearAllMocks(); localStorage.clear();
 connection.onAuth.mockImplementation(callback => { auth = callback; callback(null); return vi.fn(); });
 connection.subscribe.mockImplementation((_uid, callback) => { snapshot = callback; return vi.fn(); });
 connection.signIn.mockResolvedValue({}); connection.signOut.mockImplementation(async () => auth(null));
 root = document.createElement('div'); document.body.append(root);
 await act(() => render(<App/>, root));
});
afterEach(async () => { await act(() => render(null, root)); root.remove(); });
describe('account workspace', () => {
 it('starts Google sign-in from the visible button', async () => { await click('Войти через Google'); expect(connection.signIn).toHaveBeenCalledOnce(); });
 it('separates cloud data from demo and clears it after sign-out', async () => {
  await act(() => auth({ uid: 'alice', email: 'alice@example.com', displayName: 'Алиса' }));
  const data = { ...empty(), revision: 3, records: [{ id: 'secret', kind: 'project', name: 'Личный проект', color: 'blue' }] };
  await act(() => snapshot(data, true));
  await click('Записи'); expect(root.textContent).toContain('Личный проект');
  await click('Настройки'); await click('Открыть демо'); await click('Записи'); expect(root.textContent).not.toContain('Личный проект');
  await click('Настройки'); await click('Перейти к своему'); await click('Записи'); expect(root.textContent).toContain('Личный проект');
  await click('Настройки'); await click('Выйти из аккаунта'); await click('Записи'); expect(root.textContent).not.toContain('Личный проект');
 });
 it('never calls a cached snapshot synchronized before the server responds', async () => {
  await act(() => auth({ uid: 'alice', email: 'alice@example.com' }));
  await act(() => snapshot({ ...empty(), revision: 1 }, false));
  expect(root.textContent).toContain('Загружаем личное расписание');
  await act(() => snapshot({ ...empty(), revision: 1 }, true));
  expect(root.textContent).toContain('Синхронизировано с аккаунтом');
 });
});
