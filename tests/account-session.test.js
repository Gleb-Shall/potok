import test from 'node:test';
import assert from 'node:assert/strict';
import { createAccountSession } from '../src/lib/account-session.js';

function setup() {
  let auth, authError;
  const streams = [];
  const client = createAccountSession({
    onAuth(callback, onError) { auth = callback; authError = onError; },
    subscribe(uid, callback, onError) {
      const stream = { uid, callback, onError, stopped: false };
      streams.push(stream);
      return () => { stream.stopped = true; };
    }
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
