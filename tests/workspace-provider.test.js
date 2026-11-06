import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorkspaceProvider, saveWithFreshData, WorkspaceConflictError } from '../src/lib/workspace-provider.js';

test('each mutation fetches authoritative state before comparing and saving',async()=>{
  const order=[];
  const client={fetch:async id=>{order.push(['read',id]);return {revision:3};},save:async(id,next,revision)=>{order.push(['cas',id,next,revision]);return {revision:4};}};
  const next={events:[{id:'meeting'}]};
  assert.deepEqual(await saveWithFreshData(client,'person',next,3),{revision:4});
  assert.deepEqual(order,[['read','person'],['cas','person',next,3]]);
});

test('a newer server revision is exposed but never overwritten by an old draft',async()=>{
  let called=false,received;
  const fresh={revision:4,events:[{id:'remote-edit'}]};
  await assert.rejects(saveWithFreshData({fetch:async()=>fresh,save:()=>{called=true;}},'person',{},3,{onFresh:data=>{received=data;}}),WorkspaceConflictError);
  assert.equal(called,false);assert.equal(received,fresh);
});

test('a failed authoritative read prevents every write',async()=>{
  let writes=0;
  await assert.rejects(saveWithFreshData({fetch:async()=>{throw Error('offline');},save:()=>{writes++;}},'person',{},3),/offline/);
  assert.equal(writes,0);
});

test('a concurrent edit between preflight and CAS still rejects the mutation',async()=>{
  let revision=3;
  const client={fetch:async()=>({revision}),save:async(_id,_next,expected)=>{if(expected!==revision)throw new WorkspaceConflictError();return {revision:++revision};}};
  await assert.rejects(saveWithFreshData(client,'person',{},3,{onFresh:()=>{revision=4;}}),WorkspaceConflictError);
  assert.equal(revision,4);
});

test('an identity change during the preflight prevents a write',async()=>{
  let current=true,writes=0;
  const client={fetch:async()=>{current=false;return {revision:3};},save:()=>{writes++;}};
  await assert.rejects(saveWithFreshData(client,'person',{},3,{assertCurrent:()=>{if(!current)throw Error('account changed');}}),/account changed/);
  assert.equal(writes,0);
});

test('custom auth and storage compose without Google or Firebase types',async()=>{
  let identity,changes;
  const provider=createWorkspaceProvider({id:'own-server',name:'Own server',connect:async()=>({
    auth:{subscribe:callback=>{identity=callback;return ()=>{};},signIn:async()=>{},signOut:async()=>identity(null)},
    storage:{subscribe:(_id,callback)=>{changes=callback;return ()=>{};},read:async()=>({revision:2}),compareAndSwap:async()=>({revision:3})},
  })});
  const connection=await provider.connect();
  assert.equal(connection,await provider.connect());
  identity({id:'custom-person',displayName:'Свой аккаунт'});changes({revision:1},true);
  assert.equal(provider.getSession().user.id,'custom-person');
  assert.deepEqual(await connection.fetch('custom-person'),{revision:2});
  await connection.signOut();assert.equal(provider.getSession().user,null);
});

test('disposing an adapter removes auth and workspace listeners exactly once',async()=>{
 let auth,stoppedAuth=0,stoppedData=0,disposed=0;
 const provider=createWorkspaceProvider({id:'own',connect:async()=>({
   auth:{subscribe:callback=>{auth=callback;return ()=>stoppedAuth++;},signIn:async()=>{},signOut:async()=>{}},
   storage:{subscribe:()=>()=>stoppedData++,read:async()=>({revision:0}),compareAndSwap:async()=>({revision:1})},
   dispose:()=>disposed++,
 })});
 const connection=await provider.connect();auth({id:'person',accessToken:'must-stay-in-adapter'});
 assert.equal(provider.getSession().user.accessToken,undefined);
 connection.dispose();provider.dispose();provider.dispose();
 assert.deepEqual([stoppedAuth,stoppedData,disposed],[1,1,1]);
 assert.equal(provider.getSession(),undefined);
});

test('invalid account identities fail closed instead of sharing an undefined id',async()=>{
 let auth;
 const provider=createWorkspaceProvider({id:'own',connect:async()=>({
   auth:{subscribe:callback=>{auth=callback;return ()=>{};},signIn:async()=>{},signOut:async()=>{}},
   storage:{subscribe:()=>()=>{},read:async()=>({revision:0}),compareAndSwap:async()=>({revision:1})},
 })});
 const connection=await provider.connect();auth({name:'No identity'});
 assert.equal(connection.getSession().user,null);
 assert.match(connection.getSession().error.message,/нет id/);
 provider.dispose();
});
