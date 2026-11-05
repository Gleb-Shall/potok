import test from 'node:test';
import assert from 'node:assert/strict';
import { activeReminders, nextReminderAt, reminderMessage, parseReminderTime, tomorrowReminder, saveReminder, removeReminder } from '../src/lib/reminders.js';
import { normalizeData, moveEvent } from '../src/lib/events.js';
import { emptyData } from '../src/lib/storage.js';
import { prepareWorkspace } from '../src/lib/cloud-workspace.js';
const now=Date.parse('2026-11-05T20:30:00Z');
const data=()=>({...emptyData(),events:[{id:'e',title:'Занятие с Анной',status:'pending',date:null,start:900,duration:60}]});
test('tomorrow is 09:00 Moscow even across local day boundaries',()=>{
 assert.equal(tomorrowReminder(now),'2026-11-06T09:00');
 assert.equal(tomorrowReminder(Date.parse('2026-11-05T21:30:00Z')),'2026-11-07T09:00');
 assert.equal(parseReminderTime('2026-11-06T09:00',now),'2026-11-06T06:00:00.000Z');
});
test('invalid, past and excessive dates do not become scheduled reminders',()=>{
 for(const value of ['2026-02-30T09:00','2026-11-05T20:00','2028-11-06T09:00','not-a-date']) assert.throws(()=>parseReminderTime(value,now));
});
test('one reminder belongs to one concrete event and rescheduling replaces its delivery id',()=>{
 const first=saveReminder(data(),'e','2026-11-06T09:00',now);
 const next=saveReminder(first,'e','2026-11-06T14:00',now);
 assert.equal(next.reminders.length,1);assert.notEqual(first.reminders[0].id,next.reminders[0].id);
 assert.equal(reminderMessage(next,next.reminders[0]).title,'Занятие с Анной');
 assert.equal(removeReminder(next,'e').reminders.length,0);
});
test('move, completion, cancellation and deletion remove reminders at persistence boundary',()=>{
 const scheduled=saveReminder(data(),'e','2026-11-06T09:00',now);
 for(const status of ['planned','done','cancelled']) {
  const copy={...scheduled,events:[{...scheduled.events[0],typeId:'personal',status,snapshot:{}}]};
  assert.equal(activeReminders(copy).length,0);assert.equal(normalizeData(copy).reminders.length,0);
 }
 const moved={...scheduled,events:[moveEvent(scheduled.events[0],'2026-11-06',900,60)]};
 assert.equal(activeReminders(moved).length,0);
 assert.equal(activeReminders({...scheduled,events:[]}).length,0);
 assert.throws(()=>saveReminder(moved,'e','2026-11-06T09:00',now));
});
test('delivery index selects earliest eligible reminder and excludes settled ids',()=>{
 const scheduled=saveReminder(data(),'e','2026-11-06T09:00',now);
 const first=scheduled.reminders[0];
 assert.equal(nextReminderAt(scheduled),Date.parse(first.at));
 assert.equal(nextReminderAt(scheduled,new Set([first.id])),0);
 assert.equal(prepareWorkspace(scheduled,0).nextReminderAt,undefined);
 assert.equal(prepareWorkspace(scheduled,0,null,{publishReminders:true}).nextReminderAt,Date.parse(first.at));
 assert.equal(nextReminderAt({events:{},reminders:[null]}),0);
});
