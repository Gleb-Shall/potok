import test from 'node:test';
import assert from 'node:assert/strict';
import { connectFirebase } from '../src/lib/firebase-client.js';
import { createFirebaseProvider } from '../src/adapters/firebase/index.js';
test('real Firebase SDK registers auth and firestore with one shared app core', async () => {
 const client = await connectFirebase({apiKey:'test-key',authDomain:'demo-potok.firebaseapp.com',projectId:'demo-potok',appId:'test-app'});
 assert.equal(typeof client.signIn, 'function'); assert.equal(typeof client.save, 'function');
 let stop;
 const user = await new Promise((resolve, reject) => { stop = client.onAuth(resolve, reject); });
 stop();
 assert.equal(user, null);
});
test('recreating an adapter reuses the existing Firestore instance and auth cache namespace',async()=>{
 const config={apiKey:'test-key',authDomain:'demo-potok.firebaseapp.com',projectId:'demo-potok',appId:'test-app'};
 for(let index=0;index<2;index++) {
   const provider=createFirebaseProvider({config});
   const connection=await provider.connect();
   assert.equal(typeof connection.fetch,'function');
   provider.dispose();
 }
});
test('a distribution can override the Google popup with its own native browser flow',async()=>{
 let called=0;
 const provider=createFirebaseProvider({config:{apiKey:'test-key',authDomain:'demo-potok.firebaseapp.com',projectId:'demo-potok',appId:'test-app'},signIn:async({auth,google,authSDK})=>{
  called++;assert.equal(auth.app.name,'[DEFAULT]');assert.equal(google.providerId,'google.com');assert.equal(typeof authSDK.signInWithCredential,'function');return 'native';
 }});
 const connection=await provider.connect();
 assert.equal(await connection.signIn(),'native');assert.equal(called,1);provider.dispose();
});
