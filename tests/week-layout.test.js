import { test } from 'node:test';
import assert from 'node:assert/strict';
import {layoutDay,weekBounds,minuteAt,readTimeTarget} from '../src/lib/week-layout.js';

test('overlap groups use distinct tracks, adjacent events reuse full width and source order is untouched',()=>{
 const events=[{id:'c',start:660,duration:60},{id:'b',start:630,duration:60},{id:'a',start:600,duration:60},{id:'d',start:720,duration:60}];
 const layout=layoutDay(events);
 assert.deepEqual(events.map(item=>item.id),['c','b','a','d']);
 assert.deepEqual(layout.map(({event,column,columns})=>[event.id,column,columns]),[['a',0,2],['b',1,2],['c',0,2],['d',0,1]]);
});
test('visible hours include early and late events without hiding them',()=>{
 assert.deepEqual(weekBounds([]),{start:420,end:1380});
 assert.deepEqual(weekBounds([{start:30,duration:15},{start:1380,duration:60}],8,20),{start:0,end:1440});
});
test('drops snap to quarter hours, fit the full duration and allow same-day time targets',()=>{
 assert.equal(minuteAt(125,0,760,420,1020,90),525);
 assert.equal(minuteAt(800,0,760,420,1020,90),930);
 assert.equal(minuteAt(1600,0,1824,0,1440,150),1260);
 assert.deepEqual(readTimeTarget('2026-11-05@630'),{date:'2026-11-05',start:630});
 assert.deepEqual(readTimeTarget('2026-11-05'),{date:'2026-11-05',start:null});
 assert.equal(readTimeTarget('pending'),null);assert.equal(readTimeTarget('2026-11-05@1440'),null);
});
