import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { render } from 'preact';
import { useState } from 'preact/hooks';
import { act } from 'preact/test-utils';
import { useWorkspace } from '../src/hooks/useWorkspace.js';
import { emptyData } from '../src/lib/storage.js';
const connection = vi.hoisted(() => ({ onAuth: vi.fn(), subscribe: vi.fn(), save: vi.fn() }));
vi.mock('../src/lib/firebase-client.js', () => ({ connectFirebase: vi.fn(async () => connection), explainFirebaseError: e => e.message }));
let root, auth, snapshot;
const data = revision => ({ ...emptyData(), records: [], revision });
function Harness() {
 const [editing, setEditing] = useState(false), [error, setError] = useState('');
 const workspace = useWorkspace(editing);
 return <><output>{`${workspace.session.mode}:${workspace.session.data.revision || 0}:${workspace.account.saving}:${workspace.stale}`}</output><span role="alert">{error}</span><button onClick={() => setEditing(true)}>edit</button><button onClick={() => { setEditing(false); workspace.refresh(); }}>refresh</button><button onClick={async () => { try { await workspace.save(data(0)); } catch(e) {setError(e.message);} }}>save</button></>;
}
const settle = () => new Promise(resolve => setTimeout(resolve, 0));
const click = async text => act(async () => { [...root.querySelectorAll('button')].find(b=>b.textContent===text).click(); await settle(); });
const status = () => root.querySelector('output').textContent;
beforeEach(async () => {
 vi.clearAllMocks(); localStorage.clear();
 connection.onAuth.mockImplementation(callback => {auth=callback;callback(null);return vi.fn();});
 connection.subscribe.mockImplementation((_uid, callback) => {snapshot=callback;return vi.fn();});
 root=document.createElement('div'); document.body.append(root);
 await act(() => render(<Harness/>,root));
 await act(() => auth({uid:'alice'})); await act(() => snapshot(data(3),true));
});
afterEach(async () => {await act(()=>render(null,root));root.remove();vi.unstubAllGlobals();});
it('freezes remote changes while editing and uses old revision for conflict detection',async () => {
 await click('edit');await act(()=>snapshot(data(4),true));
 expect(status()).toBe('cloud:3:false:true');
 connection.save.mockRejectedValue(new Error('Конфликт'));
 await click('save');expect(connection.save).toHaveBeenCalledWith('alice',expect.anything(),3);
 expect(status()).toBe('cloud:3:false:true');expect(root.textContent).toContain('Конфликт');
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
 await click('save');await act(()=>auth({uid:'bob'}));await act(()=>snapshot(data(8),true));
 expect(status()).toBe('cloud:8:false:false');
 await act(async ()=>{ finish(data(4)); await settle(); });expect(status()).toBe('cloud:8:false:false');
});
it('blocks cloud writes offline and keeps visible data',async () => {
 vi.spyOn(navigator,'onLine','get').mockReturnValue(false);
 await act(()=>window.dispatchEvent(new Event('offline')));
 await click('save');expect(connection.save).not.toHaveBeenCalled();expect(status()).toBe('cloud:3:false:false');
 expect(root.textContent).toContain('Нет интернета');
});
