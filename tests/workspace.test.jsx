import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { render } from 'preact';
import { useState } from 'preact/hooks';
import { act } from 'preact/test-utils';
import { useWorkspace } from '../src/hooks/useWorkspace.js';
import { emptyData } from '../src/lib/storage.js';
const connection = vi.hoisted(() => ({ onAuth: vi.fn(), subscribe: vi.fn(), save: vi.fn(), fetch:vi.fn() }));
const provider={id:'own-server',name:'Own server',connect:async()=>connection,getSession:()=>undefined};
let root, auth, snapshot, renderedWorkspace;
const data = revision => ({ ...emptyData(), records: [], revision });
function Harness() {
 const [editing, setEditing] = useState(false), [error, setError] = useState('');
 const workspace = useWorkspace(editing,{provider});
 renderedWorkspace=workspace;
 return <><output>{`${workspace.session.mode}:${workspace.session.data.revision || 0}:${workspace.account.saving}:${workspace.stale}`}</output><time data-sync-time>{workspace.account.lastSyncedAt || 'none'}</time><span data-sync-state>{String(workspace.account.syncing)}</span><span role="alert">{error || workspace.account.syncError}</span><button onClick={async()=>{try{await workspace.sync();}catch(e){setError(e.message);}}}>sync</button><button onClick={() => setEditing(true)}>edit</button><button onClick={() => { setEditing(false); workspace.refresh(); }}>refresh</button><button onClick={async () => { try { await workspace.save(data(0)); } catch(e) {setError(e.message);} }}>save</button></>;
}
const settle = () => new Promise(resolve => setTimeout(resolve, 0));
const click = async text => act(async () => { [...root.querySelectorAll('button')].find(b=>b.textContent===text).click(); await settle(); });
const status = () => root.querySelector('output').textContent;
beforeEach(async () => {
 vi.clearAllMocks(); localStorage.clear();
 connection.fetch.mockReset().mockResolvedValue(data(3)); connection.save.mockReset();
 connection.onAuth.mockImplementation(callback => {auth=callback;callback(null);return vi.fn();});
 connection.subscribe.mockImplementation((_uid, callback) => {snapshot=callback;return vi.fn();});
 root=document.createElement('div'); document.body.append(root);
 await act(() => render(<Harness/>,root));
 await act(() => auth({id:'alice'})); await act(() => snapshot(data(3),true));
});
afterEach(async () => {await act(()=>render(null,root));root.remove();vi.unstubAllGlobals();vi.restoreAllMocks();});
it('freezes remote changes while editing and uses old revision for conflict detection',async () => {
 await click('edit');await act(()=>snapshot(data(4),true));
 expect(status()).toBe('cloud:3:false:true');
 connection.fetch.mockResolvedValue(data(4));
 await click('save');expect(connection.fetch).toHaveBeenCalledWith('alice');expect(connection.save).not.toHaveBeenCalled();
 expect(status()).toBe('cloud:3:false:true');expect(root.textContent).toContain('изменилось на другом устройстве');
 await click('refresh');expect(status()).toBe('cloud:4:false:false');
});
it('only reports saved after acknowledgement and ignores repeated clicks in flight',async () => {
 let finish;connection.save.mockImplementation(()=>new Promise(resolve=>{finish=resolve;}));
 await click('save');expect(status()).toBe('cloud:3:true:false');
 await click('save');expect(connection.save).toHaveBeenCalledOnce();
 await act(async ()=>{ finish(data(4)); await settle(); });expect(status()).toBe('cloud:4:false:false');
});
it('never applies an in-flight save to a different account',async () => {
 let finish;connection.save.mockImplementation(()=>new Promise(resolve=>{finish=resolve;}));
 await click('save');await act(()=>auth({id:'bob'}));await act(()=>snapshot(data(8),true));
 expect(status()).toBe('cloud:8:false:false');
 await act(async ()=>{ finish(data(4)); await settle(); });expect(status()).toBe('cloud:8:false:false');
});
it('blocks cloud writes offline and keeps visible data',async () => {
 vi.spyOn(navigator,'onLine','get').mockReturnValue(false);
 await act(()=>window.dispatchEvent(new Event('offline')));
 await click('save');expect(connection.save).not.toHaveBeenCalled();expect(status()).toBe('cloud:3:false:false');
 expect(root.textContent).toContain('Нет интернета');
});
it('opens cached data before the server responds but blocks writes until confirmed', async () => {
 await act(()=>auth({id:'bob'}));
 await act(()=>snapshot(data(2),false));
 expect(status()).toBe('cloud:2:false:false');
 await click('save');expect(connection.save).not.toHaveBeenCalled();
 expect(root.textContent).toContain('Дождись загрузки');
 await act(()=>snapshot(data(3),true));
 connection.save.mockResolvedValue(data(4));
 await click('save');expect(connection.save).toHaveBeenCalledWith('bob',expect.anything(),3);
 expect(status()).toBe('cloud:4:false:false');
});
it('ignores older cache data delivered after a newer server snapshot', async () => {
 await act(()=>snapshot(data(2),false));
 expect(status()).toBe('cloud:3:false:false');
});

it('manual refresh asks the server once and does not advance the time on failure',async()=>{
 await act(()=>snapshot(data(3),true,1000));
 let finish;connection.fetch.mockImplementation(()=>new Promise(resolve=>{finish=resolve;}));
 await click('sync');await click('sync');expect(connection.fetch).toHaveBeenCalledOnce();expect(root.querySelector('[data-sync-state]').textContent).toBe('true');
 await act(async()=>{snapshot(data(4),true,2000);finish(data(4));await settle();});
 expect(status()).toBe('cloud:4:false:false');expect(root.querySelector('[data-sync-time]').textContent).toBe('2000');
 connection.fetch.mockRejectedValue(new Error('No connection'));await click('sync');
 expect(root.querySelector('[data-sync-time]').textContent).toBe('2000');expect(root.textContent).toContain('No connection');
});
it('refresh on returning to a stale tab keeps an open draft and marks a remote change',async()=>{
 await click('edit');await act(()=>snapshot(data(3),true,1000));
 connection.fetch.mockImplementation(async()=>{snapshot(data(4),true,2000);return data(4);});
 await act(async()=>{window.dispatchEvent(new Event('focus'));window.dispatchEvent(new Event('focus'));await settle();});
 expect(connection.fetch).toHaveBeenCalledOnce();expect(status()).toBe('cloud:3:false:true');
 expect(root.querySelector('[data-sync-time]').textContent).toBe('2000');
});

it('retains the revision used to compute an action even if a newer render arrives',async()=>{
 const oldSave=renderedWorkspace.save;
 await act(()=>snapshot(data(4),true));
 connection.fetch.mockResolvedValue(data(4));
 await act(async()=>{await expect(oldSave(data(3))).rejects.toThrow('изменилось на другом устройстве');});
 expect(connection.save).not.toHaveBeenCalled();
 expect(status()).toBe('cloud:4:false:true');
});

it('does not write after an A to B to A account change during preflight',async()=>{
 let finish;connection.fetch.mockImplementation(()=>new Promise(resolve=>{finish=resolve;}));
 await click('save');
 await act(()=>auth({id:'bob'}));await act(()=>auth({id:'alice'}));await act(()=>snapshot(data(8),true));
 await act(async()=>{finish(data(3));await settle();});
 expect(connection.save).not.toHaveBeenCalled();expect(status()).toBe('cloud:8:false:false');
});

it('keeps the open draft and skips CAS when the preflight server read fails',async()=>{
 await click('edit');connection.fetch.mockRejectedValue(new Error('Server read failed'));
 await click('save');
 expect(connection.save).not.toHaveBeenCalled();expect(status()).toBe('cloud:3:false:false');
 expect(root.textContent).toContain('Server read failed');
});

it('reconnecting the same identity preserves the draft base instead of replacing it with empty data',async()=>{
 await click('edit');
 connection.onAuth.mockImplementation(callback=>{auth=callback;callback({id:'alice'});return vi.fn();});
 await act(()=>renderedWorkspace.reconnect());
 await act(()=>snapshot(data(4),true));
 expect(status()).toBe('cloud:3:false:true');
});
