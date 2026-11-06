import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { Site } from '../src/Site.jsx';
import { connectFirebase } from '../src/lib/firebase-client.js';
import { getFirebaseConfig, saveFirebaseConfig, clearFirebaseConfig, validateFirebaseConfig } from '../src/lib/cloud-config.js';
import { emptyData } from '../src/lib/storage.js';
import { todayISO } from '../src/lib/domain.js';

vi.mock('../src/lib/firebase-client.js',()=>({connectFirebase:vi.fn(),getFirebaseSession:()=>undefined,explainFirebaseError:error=>error.message}));
const config={apiKey:'test-key',authDomain:'own-project.firebaseapp.com',projectId:'own-project',appId:'own-app'};
let root;
beforeEach(()=>{localStorage.clear();vi.stubEnv('VITE_FIREBASE_CONFIG','');root=document.createElement('div');document.body.append(root);});
afterEach(async()=>{await act(()=>render(null,root));root.remove();localStorage.clear();vi.unstubAllEnvs();vi.clearAllMocks();});

it('opens existing local data without contacting Firebase or requiring sign-in',async()=>{
  const data=emptyData();data.events=[{id:'local',typeId:'personal',title:'Local appointment',date:todayISO(),anchorDate:todayISO(),start:600,duration:60,status:'planned',fields:{},history:[]}];
  localStorage.setItem('tutor-schedule:personal:v2',JSON.stringify(data));
  await act(()=>render(<Site/>,root));
  expect(root.querySelector('.week-timeline')).toBeTruthy();
  expect(root.querySelector('[data-event-id="local"]')).toBeTruthy();
  expect(root.querySelector('.workspace-entry')).toBeNull();
  expect(connectFirebase).not.toHaveBeenCalled();
});

it('stores only valid client identifiers and keeps the chosen project independent of schedules',()=>{
  expect(getFirebaseConfig()).toBeNull();
  localStorage.setItem('tutor-schedule:personal:v2','preserved');
  saveFirebaseConfig({...config,private_key:'must-not-be-stored'});
  expect(getFirebaseConfig()).toEqual(config);
  expect(localStorage.getItem('potok:firebase-config')).not.toContain('private_key');
  expect(()=>saveFirebaseConfig({...config,authDomain:'https://wrong.example/path'})).toThrow();
  expect(getFirebaseConfig()).toEqual(config);
  clearFirebaseConfig();expect(getFirebaseConfig()).toBeNull();
  expect(localStorage.getItem('tutor-schedule:personal:v2')).toBe('preserved');
  expect(()=>validateFirebaseConfig({projectId:'missing-other-fields'})).toThrow();
});

it('uses the hosted build configuration and prevents changing it from the client',()=>{
  saveFirebaseConfig(config);
  const hosted={...config,projectId:'hosted-project'};
  vi.stubEnv('VITE_FIREBASE_CONFIG',JSON.stringify(hosted));
  expect(getFirebaseConfig()).toEqual(hosted);
  expect(()=>saveFirebaseConfig(config)).toThrow();
  expect(()=>clearFirebaseConfig()).toThrow();
});
