import test from 'node:test';
import assert from 'node:assert/strict';
import { connectFirebase } from '../src/lib/firebase-client.js';
test('real Firebase SDK registers auth and firestore with one shared app core', async () => {
 const client = await connectFirebase();
 assert.equal(typeof client.signIn, 'function'); assert.equal(typeof client.save, 'function');
 let stop;
 const user = await new Promise((resolve, reject) => { stop = client.onAuth(resolve, reject); });
 stop();
 assert.equal(user, null);
});
