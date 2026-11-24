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
 it('saves a new event on the device even when the cloud read fails',async()=>{
  await act(()=>auth({id:'alice',email:'alice@example.com'}));
  await act(()=>snapshot({...empty(),revision:3},true));
  await click('Добавить событие');
  const title=root.querySelector('.event-editor-dialog input[type=text]');
  await act(()=>{title.value='Мой черновик';title.dispatchEvent(new Event('input',{bubbles:true}));});
  connection.fetch.mockRejectedValue(new Error('Облако недоступно'));
  await act(async()=>{root.querySelector('.event-editor-dialog form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));await new Promise(resolve=>setTimeout(resolve,0));});
  expect(root.querySelector('.event-editor-dialog')).toBeNull();
  expect(root.textContent).toContain('Мой черновик');
  expect(root.querySelector('.sync-copy').textContent).toContain('На устройстве');
  expect(connection.save).not.toHaveBeenCalled();
 });
 it('exports locally saved edits after an offline restart without contacting the cloud', async () => {
  const saveBackupFile = vi.fn().mockResolvedValue(undefined);
  const online = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
  try {
   await act(() => window.dispatchEvent(new Event('offline')));
   await act(() => auth({ id: 'alice' }));
   await act(() => snapshot({ ...empty(), revision: 3 }, true));
   await click('Добавить событие');
   const title = root.querySelector('.event-editor-dialog input[type=text]');
   await act(() => {
    title.value = 'Сохранено без интернета';
    title.dispatchEvent(new Event('input', { bubbles: true }));
   });
   await act(() => root.querySelector('.event-editor-dialog form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
   await vi.waitFor(() => expect(root.querySelector('.event-editor-dialog')).toBeNull());
   await act(() => render(null, root));
   connection.onAuth.mockImplementation(callback => { callback({ id: 'alice' }); return vi.fn(); });
   await act(() => render(<App provider={provider} requireAccount saveBackupFile={saveBackupFile}/>, root));
   await vi.waitFor(() => expect(root.textContent).toContain('Сохранено без интернета'));

   await click('Настройки');
   await click('Скачать резервную копию');
   expect(saveBackupFile).toHaveBeenCalledOnce();
   const [name, contents] = saveBackupFile.mock.calls[0];
   expect(name).toMatch(/^potok-cloud-\d{4}-\d{2}-\d{2}\.json$/);
   expect(JSON.parse(contents).data.events).toEqual([expect.objectContaining({ title: 'Сохранено без интернета' })]);
   expect(connection.fetch).not.toHaveBeenCalled();
   expect(connection.save).not.toHaveBeenCalled();
  } finally { online.mockRestore(); }
 });
});
