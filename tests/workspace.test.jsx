import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { render } from 'preact';
import { useState } from 'preact/hooks';
import { act } from 'preact/test-utils';
import { useWorkspace } from '../src/hooks/useWorkspace.js';
import { emptyData } from '../src/lib/storage.js';
import { workspaceCacheKey } from '../src/lib/offline-workspace.js';

const connection = { onAuth: vi.fn(), subscribe: vi.fn(), save: vi.fn(), fetch: vi.fn() };
const provider = { id:'own-server', connect:async()=>connection };
const key = workspaceCacheKey(provider.id, 'alice');
const record = (id, name=id) => ({ id, name, kind:'student' });
const data = (revision, records=[record('existing')]) => ({ ...emptyData(), records, revision });
let root, auth, snapshot, workspace, signedIn;

function Harness() {
  const [editing, setEditing] = useState(false);
  workspace = useWorkspace(editing, { provider });
  return <button onClick={()=>setEditing(true)}>Редактировать</button>;
}

const tick = () => new Promise(resolve=>setTimeout(resolve,0));
const records = () => workspace.session.data.records.map(item=>item.name);
const edit = async () => act(()=>root.querySelector('button').click());
const save = async next => act(()=>workspace.save(next));
const sync = async preference => act(()=>workspace.sync(preference));
const changeNetwork = async online => {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(online);
  await act(()=>window.dispatchEvent(new Event(online ? 'online' : 'offline')));
};
const signIn = user => act(()=>{signedIn=user;auth(user);});

beforeEach(async () => {
  localStorage.clear();
  signedIn = { id:'alice' };
  connection.fetch.mockReset().mockResolvedValue(data(3));
  connection.save.mockReset().mockImplementation(async (_user,next,revision)=>({ ...next, revision:revision+1 }));
  connection.onAuth.mockReset().mockImplementation(callback=>{ auth=callback;callback(signedIn);return vi.fn(); });
  connection.subscribe.mockReset().mockImplementation((_user,callback)=>{ snapshot=callback;return vi.fn(); });
  root = document.createElement('div'); document.body.append(root);
  await changeNetwork(false);
  await act(()=>render(<Harness/>,root));
  await act(()=>snapshot(data(3), true));
});

afterEach(async () => {
  await act(()=>render(null,root));
  root.remove();
  vi.restoreAllMocks();
});

it('reopens the offline edit after restart and uploads it automatically after reconnecting', async () => {
  await save(data(3, [record('existing'),record('mine')]));
  expect(records()).toEqual(['existing','mine']);
  expect(workspace.account.pending).toBe(true);
  expect(connection.fetch).not.toHaveBeenCalled();
  await act(()=>render(null,root));
  await act(()=>render(<Harness/>,root));
  await act(tick);
  expect(records()).toEqual(['existing','mine']);
  expect(workspace.account.hasData).toBe(true);
  expect(workspace.account.ready).toBe(false);
  await changeNetwork(true);
  await vi.waitFor(()=>expect(connection.save).toHaveBeenCalledWith('alice',expect.objectContaining({records:[record('existing'),record('mine')]}),3));
  await act(tick);
  expect(workspace.account.pending).toBe(false);
  expect(JSON.parse(localStorage.getItem(key)).draft).toBeNull();
});

it('merges independent changes against the fresh cloud revision', async () => {
  await save(data(3,[record('existing'),record('mine')]));
  connection.fetch.mockResolvedValue(data(8,[record('existing'),record('theirs')]));
  await changeNetwork(true);
  await sync();
  expect(connection.save).toHaveBeenCalledWith('alice',expect.objectContaining({records:[record('existing'),record('theirs'),record('mine')]}),8);
  expect(records()).toEqual(['existing','theirs','mine']);
});

it.each(['local','cloud'])('asks which version to keep for a conflicting edit (%s)', async preference => {
  await save(data(3,[record('existing','Локально'),record('mine')]));
  connection.fetch.mockResolvedValue(data(4,[record('existing','В облаке'),record('theirs')]));
  await changeNetwork(true);
  await sync();
  expect(connection.save).not.toHaveBeenCalled();
  expect(workspace.account.conflict.items).toEqual([{label:'Локально'}]);
  expect(records()).toEqual(['Локально','mine']);
  await sync(preference);
  expect(records()).toEqual([preference==='local'?'Локально':'В облаке','theirs','mine']);
  expect(workspace.account.pending).toBe(false);
});

it('asks again if the cloud version changed since the conflict was shown', async () => {
  await save(data(3,[record('existing','Локально')]));
  connection.fetch.mockResolvedValue(data(4,[record('existing','В облаке')]));
  await changeNetwork(true);
  await sync();
  connection.fetch.mockResolvedValue(data(5,[record('existing','Обновлено в облаке')]));
  await sync('local');
  expect(connection.save).not.toHaveBeenCalled();
  expect(workspace.account.conflict.revision).toBe(5);
});

it('keeps changes queued on a failed read and keeps the next local edit', async () => {
  await save(data(3,[record('existing','Первое изменение')]));
  connection.fetch.mockRejectedValue(new Error('Облако недоступно'));
  await changeNetwork(true);
  await act(async ()=>{await expect(workspace.sync()).rejects.toThrow('Облако недоступно');});
  expect(connection.save).not.toHaveBeenCalled();
  expect(workspace.account.pending).toBe(true);
  await save(data(3,[record('existing','Второе изменение')]));
  expect(records()).toEqual(['Второе изменение']);
});

it('keeps a subsequent edit made during an upload for the next upload', async () => {
  await save(data(3,[record('existing','Первое изменение')]));
  let acknowledge;
  connection.save.mockImplementationOnce((_user,next)=>new Promise(resolve=>{acknowledge=()=>resolve({...next,revision:4});}));
  await changeNetwork(true);
  let upload;
  await act(async ()=>{upload=workspace.sync();await tick();});
  await save(data(3,[record('existing','Второе изменение')]));
  await act(async ()=>{acknowledge();await upload;});
  expect(records()).toEqual(['Второе изменение']);
  expect(workspace.account.pending).toBe(true);
  expect(JSON.parse(localStorage.getItem(key)).base.revision).toBe(4);
});

it('freezes the visible snapshot during editing and guards a stale save', async () => {
  const oldSave=workspace.save;
  await edit();
  await act(()=>snapshot(data(4,[record('existing','Новое значение')]),true));
  expect(records()).toEqual(['existing']);
  expect(workspace.stale).toBe(true);
  await act(async()=>{await expect(oldSave(data(3,[record('existing','Устарело')]))).rejects.toThrow('Расписание изменилось');});
  await act(()=>workspace.refresh());
  expect(records()).toEqual(['Новое значение']);
});

it('does not show another account its offline copy or write after an account switch', async () => {
  await save(data(3,[record('mine')]));
  let finishRead;
  connection.fetch.mockImplementation(()=>new Promise(resolve=>{finishRead=resolve;}));
  await changeNetwork(true);
  let upload;
  await act(async()=>{upload=workspace.sync().catch(error=>error);await tick();});
  await signIn({id:'bob'});
  expect(workspace.account.hasData).toBe(false);
  await act(()=>snapshot(data(8,[record('bob')]),true));
  await act(async()=>{finishRead(data(3));await upload;});
  expect(connection.save).not.toHaveBeenCalled();
  expect(records()).toEqual(['bob']);
  await signIn({id:'alice'});
  expect(records()).toEqual(['mine']);
});

it('times out the initial connection without making a blank cloud workspace editable', async () => {
  vi.useFakeTimers();
  try {
    await signIn({id:'bob'});
    await act(()=>vi.advanceTimersByTime(10000));
    expect(workspace.account.error).toContain('Не удалось загрузить расписание');
    expect(workspace.account.hasData).toBe(false);
    await act(()=>snapshot(data(8,[record('bob')]),true));
    expect(workspace.account.error).toBe('');
    expect(records()).toEqual(['bob']);
  } finally { vi.useRealTimers(); }
});

it('recovers a damaged local copy only from a server snapshot and keeps the original bytes', async () => {
  const damaged = '{"version":3,"draft":';
  localStorage.setItem(key, damaged);
  await signIn(null);
  await signIn({ id:'alice' });
  expect(workspace.account.error).toContain('локальную копию');

  await act(() => snapshot(data(2, [record('old')]), false));
  expect(localStorage.getItem(key)).toBe(damaged);
  expect(workspace.account.hasData).toBe(false);

  await act(() => snapshot(data(4, [record('from-server')]), true));
  expect(records()).toEqual(['from-server']);
  expect(workspace.account.error).toBe('');
  expect(workspace.account.pending).toBe(false);
  const recoveryKey = Object.keys(localStorage).find(name => name.startsWith(`${key}:recovery:`));
  expect(localStorage.getItem(recoveryKey)).toBe(damaged);
  await save(data(4, [record('from-server'), record('new-offline-edit')]));
  expect(workspace.account.pending).toBe(true);
  expect(connection.save).not.toHaveBeenCalled();
});

it('invalidates an open editor even when recovery returns the same server revision', async () => {
  await edit();
  const oldSave = workspace.save;
  localStorage.setItem(key, '{');
  await act(() => snapshot(data(3, [record('restored')]), true));
  expect(workspace.stale).toBe(true);
  await act(async () => {
    await expect(oldSave(data(3, [record('old-editor')]))).rejects.toThrow('Расписание изменилось');
  });
  await act(() => workspace.refresh());
  expect(records()).toEqual(['restored']);
});

it('ignores older cache data and keeps local changes after a cloud CAS failure', async () => {
  await act(()=>snapshot(data(2,[record('old')]),false));
  expect(records()).toEqual(['existing']);
  await save(data(3,[record('existing'),record('mine')]));
  connection.save.mockRejectedValue(Object.assign(new Error('Версия изменилась'), {code:'workspace/conflict'}));
  await changeNetwork(true);
  await act(async()=>{await expect(workspace.sync()).rejects.toThrow('Версия изменилась');});
  expect(workspace.account.pending).toBe(true);
  expect(records()).toEqual(['existing','mine']);
});

it('pauses sync if independently created busy events overlap', async () => {
  const event = id => ({id, typeId:'lesson', title:id, date:'2026-11-12', start:600, duration:60, status:'planned', busy:true});
  await save({...data(3), events:[event('Локальное')]});
  connection.fetch.mockResolvedValue({...data(4), events:[event('Из облака')]});
  await changeNetwork(true);
  await sync();
  expect(workspace.account.conflict.reason).toBe('overlap');
  expect(connection.save).not.toHaveBeenCalled();
  expect(workspace.session.data.events[0].id).toBe('Локальное');
});

it('keeps a newer server snapshot delivered while an upload is awaiting confirmation', async () => {
  await save(data(3,[record('existing'),record('mine')]));
  let acknowledge;
  connection.save.mockImplementationOnce((_user,next)=>new Promise(resolve=>{acknowledge=()=>resolve({...next,revision:4});}));
  await changeNetwork(true);
  let upload;
  await act(async()=>{upload=workspace.sync();await tick();});
  await act(()=>snapshot(data(5,[record('existing'),record('mine'),record('newer')]),true));
  await act(async()=>{acknowledge();await upload;});
  expect(records()).toEqual(['existing','mine','newer']);
  expect(workspace.account.pending).toBe(false);
  expect(JSON.parse(localStorage.getItem(key)).base.revision).toBe(5);
});
