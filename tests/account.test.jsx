import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { App } from '../src/App.jsx';
import { defaultTypes } from '../src/lib/events.js';
const connection = vi.hoisted(() => ({ onAuth: vi.fn(), signIn: vi.fn(), signOut: vi.fn(), subscribe: vi.fn(), save: vi.fn(), fetch:vi.fn() }));
const provider={id:'custom-auth',name:'Свой сервер',signInLabel:'Войти в свой сервис',connect:async()=>connection,getSession:()=>undefined};
let root, auth, snapshot;
const empty = () => ({ version: 2, revision: 0, students: [], records: [], types: defaultTypes(), series: [], events: [] });
const click = async text => { const button = [...root.querySelectorAll('button')].find(b => b.textContent.includes(text)); expect(button).toBeTruthy(); await act(() => button.click()); };
beforeEach(async () => {
 vi.clearAllMocks(); localStorage.clear();
 HTMLDialogElement.prototype.showModal=function(){this.open=true;};HTMLDialogElement.prototype.close=function(){this.open=false;};
 connection.onAuth.mockImplementation(callback => { auth = callback; callback(null); return vi.fn(); });
 connection.subscribe.mockImplementation((_uid, callback) => { snapshot = callback; return vi.fn(); });
 connection.signIn.mockResolvedValue({}); connection.signOut.mockImplementation(async () => auth(null));
 root = document.createElement('div'); document.body.append(root);
 await act(() => render(<App provider={provider}/>, root));
});
afterEach(async () => { await act(() => render(null, root)); root.remove(); });
describe('account workspace', () => {
 it('starts custom sign-in from the visible button', async () => { await click('Войти в свой сервис'); expect(connection.signIn).toHaveBeenCalledOnce(); });
 it('separates cloud data from demo and clears it after sign-out', async () => {
  await act(() => auth({ id: 'alice', email: 'alice@example.com', displayName: 'Алиса' }));
  const data = { ...empty(), revision: 3, records: [{ id: 'secret', kind: 'project', name: 'Личный проект', color: 'blue' }] };
  await act(() => snapshot(data, true));
  await click('Записи'); expect(root.textContent).toContain('Личный проект');
  await click('Настройки'); await click('Открыть демо'); await click('Записи'); expect(root.textContent).not.toContain('Личный проект');
  await click('Настройки'); await click('Перейти к своему'); await click('Записи'); expect(root.textContent).toContain('Личный проект');
  await click('Настройки'); await click('Выйти из аккаунта'); await click('Записи'); expect(root.textContent).not.toContain('Личный проект');
 });
 it('never calls a cached snapshot synchronized before the server responds', async () => {
  await act(() => auth({ id: 'alice', email: 'alice@example.com' }));
  await act(() => snapshot({ ...empty(), revision: 1 }, false));
  expect(root.textContent).toContain('Показана сохранённая копия');
  expect(root.querySelector('.sync-copy').textContent).not.toContain('Обновлено');
  await act(() => snapshot({ ...empty(), revision: 1 }, true));
  expect(root.querySelector('.sync-copy').textContent).toContain('Обновлено');
 });
 it('shows a preflight conflict inside the editor and preserves its draft',async()=>{
  await act(()=>auth({id:'alice',email:'alice@example.com'}));
  await act(()=>snapshot({...empty(),revision:3},true));
  await click('Добавить событие');
  const title=root.querySelector('.event-editor-dialog input[type=text]');
  await act(()=>{title.value='Мой черновик';title.dispatchEvent(new Event('input',{bubbles:true}));});
  connection.fetch.mockResolvedValue({...empty(),revision:4});
  await act(async()=>{root.querySelector('.event-editor-dialog form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));await new Promise(resolve=>setTimeout(resolve,0));});
  expect(root.querySelector('.event-editor-dialog input[type=text]').value).toBe('Мой черновик');
  expect(root.querySelector('.event-editor-dialog [role=alert]').textContent).toContain('Расписание изменилось');
  expect(connection.save).not.toHaveBeenCalled();
 });
});
