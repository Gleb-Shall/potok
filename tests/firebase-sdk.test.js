import test from 'node:test';
import assert from 'node:assert/strict';
import { connectFirebase } from '../src/lib/firebase-client.js';
test('real Firebase SDK registers auth and firestore with one shared app core', async () => {
 const client = await connectFirebase();
 assert.equal(typeof client.signIn, 'function'); assert.equal(typeof client.save, 'function');
 const user = await new Promise((resolve, reject) => { const stop = client.onAuth(value => { stop(); resolve(value); }, reject); });
 assert.equal(user, null);
});
