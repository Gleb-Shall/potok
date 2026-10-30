import { before, after, beforeEach, test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
let env;
const ref = (db, uid = 'alice') => doc(db, 'users', uid, 'workspaces', 'main');
const value = revision => ({ version: 2, revision, payload: '{}', updatedAt: serverTimestamp() });
before(async () => { env = await initializeTestEnvironment({ projectId: 'demo-potok', firestore: { rules: await readFile('firestore.rules', 'utf8') } }); });
beforeEach(() => env.clearFirestore());
after(() => env?.cleanup());
test('anonymous and another account cannot read or write private schedules', async () => {
 const alice = env.authenticatedContext('alice').firestore();
 await assertSucceeds(setDoc(ref(alice), value(1)));
 for (const db of [env.unauthenticatedContext().firestore(), env.authenticatedContext('bob').firestore()]) {
  await assertFails(getDoc(ref(db))); await assertFails(setDoc(ref(db), value(2)));
 }
 await assertSucceeds(getDoc(ref(alice)));
});
test('owner updates require the next revision and server timestamp', async () => {
 const db = env.authenticatedContext('alice').firestore();
 await assertFails(setDoc(ref(db), value(2)));
 await assertSucceeds(setDoc(ref(db), value(1)));
 await assertFails(setDoc(ref(db), value(1)));
 await assertFails(setDoc(ref(db), { ...value(2), updatedAt: new Date(0) }));
 await assertSucceeds(setDoc(ref(db), value(2)));
 await assertFails(deleteDoc(ref(db)));
});
test('unknown fields, invalid schema and unrelated paths are denied', async () => {
 const db = env.authenticatedContext('alice').firestore();
 await assertFails(setDoc(ref(db), { ...value(1), unexpected: true }));
 await assertFails(setDoc(ref(db), { ...value(1), payload: [] }));
 await assertFails(setDoc(ref(db), { ...value(1), version: 1 }));
 await assertFails(setDoc(doc(db, 'users/alice/workspaces/other'), value(1)));
 await assertFails(setDoc(doc(db, 'users/alice/students/old'), { name: 'test' }));
});
