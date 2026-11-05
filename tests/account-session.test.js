import test from 'node:test';
import assert from 'node:assert/strict';
import { createAccountSession } from '../src/lib/account-session.js';

function setup(extra={}) {
  let auth, authError;
  const streams = [];
  const client = createAccountSession({
    onAuth(callback, onError) { auth = callback; authError = onError; },
    subscribe(uid, callback, onError) {
      const stream = { uid, callback, onError, stopped: false };
      streams.push(stream);
      return () => { stream.stopped = true; };
    },...extra
  });
  return { client, streams, login: user => auth(user), failAuth: error => authError(error) };
}
test('warms the workspace before mounting and reuses it across page subscriptions', () => {
  const { client, streams, login } = setup();
  assert.equal(client.getSession().resolved, false);
  login({ uid: 'alice' });
  streams[0].callback({ revision: 3 }, true);
  const received = [];
  const off = client.subscribe('alice', (data, server) => received.push([data.revision, server]));
  off();
  client.subscribe('alice', (data, server) => received.push([data.revision, server]));
  assert.deepEqual(received, [[3, true], [3, true]]);
  assert.equal(streams.length, 1);
});
test('clears the previous account and ignores its late stream responses', () => {
  const { client, streams, login } = setup();
  login({ uid: 'alice' }); streams[0].callback({ revision: 3 }, true);
  login({ uid: 'bob' });
  assert.equal(streams[0].stopped, true);
  streams[0].callback({ revision: 99 }, true);
  assert.equal(client.getSession().data, null);
  let received = null;
  client.subscribe('bob', data => { received = data; });
  streams[1].callback({ revision: 5 }, false);
  assert.deepEqual(received, { revision: 5 });
  login(null);
  assert.equal(client.getSession().data, null);
  assert.equal(client.getSession().user, null);
});
test('revoked access discards the retained snapshot and reconnects a failed stream', () => {
  const { client, streams, login } = setup();
  login({ uid: 'alice' }); streams[0].callback({ revision: 3 }, true);
  streams[0].onError({ code: 'permission-denied' });
  assert.equal(client.getSession().data, null);
  client.subscribe('alice', () => {});
  assert.equal(streams.length, 2);
});
test('auth failures discard the verified account and its data', () => {
  const { client, streams, login, failAuth } = setup();
  login({ uid: 'alice' }); streams[0].callback({ revision: 3 }, true);
  failAuth(new Error('Auth failed'));
  assert.equal(client.getSession().user, null);
  assert.equal(client.getSession().data, null);
  assert.equal(streams[0].stopped, true);
});
test('only server confirmations advance sync time, including manual refresh and saves', async t => {
 let now=1000;t.mock.method(Date,'now',()=>now);
 const remembered=[];
 const {client,streams,login}=setup({fetch:async()=>({revision:4}),save:async()=>({revision:5}),rememberSync:(uid,at)=>remembered.push([uid,at])});
 login({uid:'alice'});streams[0].callback({revision:2},false);assert.equal(client.getSession().lastSyncedAt,null);
 streams[0].callback({revision:3},true);assert.equal(client.getSession().lastSyncedAt,1000);
 now=2000;streams[0].callback({revision:3},false);assert.equal(client.getSession().lastSyncedAt,1000);
 let replay;client.subscribe('alice',(_data,_server,at)=>{replay=at;});assert.equal(replay,1000);
 await client.fetch('alice');assert.equal(client.getSession().data.revision,4);assert.equal(client.getSession().lastSyncedAt,2000);
 now=3000;await client.save('alice',{},4);assert.equal(client.getSession().lastSyncedAt,3000);assert.deepEqual(remembered.at(-1),['alice',3000]);
});
test('an unsuccessful fetch retains the last success and a late fetch cannot cross an account change',async()=>{
 let finish;
 const {client,streams,login}=setup({fetch:()=>new Promise(resolve=>{finish=resolve;})});
 login({uid:'alice'});streams[0].callback({revision:3},true);const stamp=client.getSession().lastSyncedAt;
 const waiting=client.fetch('alice');login({uid:'bob'});login({uid:'alice'});finish({revision:99});
 await assert.rejects(waiting,/Аккаунт изменился/);assert.equal(client.getSession().data,null);assert.equal(client.getSession().lastSyncedAt,null);
 const failing=setup({fetch:async()=>{throw new Error('No connection');}});failing.login({uid:'alice'});failing.streams[0].callback({revision:3},true);const before=failing.client.getSession().lastSyncedAt;
 await assert.rejects(failing.client.fetch('alice'),/No connection/);assert.equal(failing.client.getSession().lastSyncedAt,before);assert.ok(stamp);
});
