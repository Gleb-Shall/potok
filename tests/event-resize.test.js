import test from 'node:test';
import assert from 'node:assert/strict';
import {resizedTiming} from '../src/hooks/useEventResize.js';
test('resizing keeps the opposite edge fixed, snaps and stays within the day',()=>{
 const event={start:600,duration:60};
 assert.deepEqual(resizedTiming(event,'end',37),{start:600,duration:90});
 assert.deepEqual(resizedTiming(event,'start',-37),{start:570,duration:90});
 assert.deepEqual(resizedTiming(event,'start',1000),{start:645,duration:15});
 assert.deepEqual(resizedTiming(event,'start',-1000),{start:0,duration:660});
 assert.deepEqual(resizedTiming(event,'end',-1000),{start:600,duration:15});
 assert.deepEqual(resizedTiming(event,'end',1000),{start:600,duration:840});
 const short={start:600,duration:5};
 assert.deepEqual(resizedTiming(short,'start',0),short);
 assert.deepEqual(resizedTiming(short,'end',0),short);
});
