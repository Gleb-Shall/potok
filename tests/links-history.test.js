import test from 'node:test';
import assert from 'node:assert/strict';
import { linkHref, linkParts, recordLinks } from '../src/lib/links.js';
import { defaultTypes, projectWeek, saveMove, normalizeData, deleteRecord, saveEvent, validateEvent, saveStudent } from '../src/lib/events.js';
import { eventHasEnded, setEventStatus, stopSeries, historyEvents } from '../src/lib/event-history.js';
const now = Date.parse('2026-10-30T12:00:00+03:00');
const record = { id: 's', name: 'Ученик', kind: 'student', subject: 'Математика', contact: '', rate: 1000, color: 'violet', details: [{ id: 'board', label: 'Доска', type: 'url', value: 'https://board.example.com/student', showOnCard: true }] };
const base = () => ({ version: 2, students: [structuredClone(record)], records: [], types: defaultTypes(), series: [{ id: 'weekly', typeId: 'lesson', title: 'Занятие', studentId: 's', fields: { topic: 'Тема' }, from: '2026-10-02', until: '', weekday: 5, start: 600, duration: 60, intervalWeeks: 1 }], events: [] });

test('only web links become clickable, including domain normalization', () => {
 assert.equal(linkHref('www.example.com/board'), 'https://www.example.com/board');
 assert.equal(linkHref('telemost.yandex.ru/j/123'), 'https://telemost.yandex.ru/j/123');
 for (const value of ['javascript:alert(1)', 'data:text/html,test', 'file:///tmp/a', '//evil.com', 'https://example.com\n/x', 'not a link']) assert.equal(linkHref(value), '');
});
test('named hyperlinks and plain links retain readable punctuation without injecting HTML', () => {
 const parts = linkParts('Вход: [Телемост](https://telemost.yandex.ru/j/123), доска https://board.example.com/a.');
 assert.deepEqual(parts.filter(item => item.href).map(item=>[item.text,item.href]), [['Телемост','https://telemost.yandex.ru/j/123'],['https://board.example.com/a','https://board.example.com/a']]);
 assert.equal(parts.map(item=>item.text).join(''), 'Вход: Телемост, доска https://board.example.com/a.');
 assert.equal(linkParts('[Нельзя](javascript:alert(1))').some(item=>item.href), false);
 assert.equal(linkParts('https://en.wikipedia.org/wiki/A_(B)').find(item=>item.href).href, 'https://en.wikipedia.org/wiki/A_(B)');
});
test('record links respect visibility and avoid duplicate destinations', () => {
 const source = { ...record, contact: 'https://board.example.com/student', details: [...record.details, { label:'Скрытая', value:'https://hidden.example.com', showOnCard:false }] };
 assert.deepEqual(recordLinks(source), [{ label:'Доска', href:'https://board.example.com/student' }]);
});
test('URL field validation also applies to student custom fields', () => {
 const data = base(); data.types[0].fields.push({ id:'call', label:'Телемост', type:'url' });
 const item = projectWeek(data, '2026-10-26').events[0];
 assert.throws(()=>validateEvent(data,{...item,fields:{call:'javascript:alert(1)'}}), /Телемост/);
 assert.doesNotThrow(()=>validateEvent(data,{...item,fields:{call:'https://telemost.yandex.ru/j/123'}}));
 assert.throws(()=>saveStudent(data,{...record,details:[{label:'Ссылка',type:'url',value:'javascript:alert(1)'}]}), /Ссылка/);
});
test('past time uses Moscow and the end time, including midnight, and never implies done', () => {
 const data = base(), item = projectWeek(data, '2026-10-26').events[0];
 assert.equal(eventHasEnded(item, now), true); assert.equal(item.status, 'planned');
 assert.equal(eventHasEnded({...item,start:720},now), false);
 assert.equal(eventHasEnded({...item,date:'2026-10-29',start:1380,duration:60}, Date.parse('2026-10-29T21:00:00Z')), true);
 assert.equal(eventHasEnded({...item,date:null,status:'pending'},now),false);
});
test('completion persists an independent copy of record and template information', () => {
 const data = base(), item = projectWeek(data, '2026-10-26').events[0];
 let saved = setEventStatus(data,item,'done',now);
 saved.students[0].details[0].value='https://new.example.com'; saved.types[0].fields[0].label='Новое поле';
 assert.equal(saved.events[0].snapshot.record.details[0].value,'https://board.example.com/student');
 assert.equal(saved.events[0].snapshot.type.fields[0].label,'Тема');
 saved=deleteRecord(saved,record,false);
 assert.equal(saved.events[0].snapshot.record.name,'Ученик');
 const restored = normalizeData(JSON.parse(JSON.stringify(saved)));
 assert.equal(restored.events[0].status,'done'); assert.equal(restored.events[0].completedAt,new Date(now).toISOString());
 const unmarked=setEventStatus(restored,restored.events[0],'planned',now);assert.equal(unmarked.events[0].snapshot,undefined);
});
test('stopping repeats preserves all earlier dates and the lesson already held today', () => {
 const data=base(), item=projectWeek(data,'2026-10-26').events[0];
 const stopped=stopSeries(data,item,'2026-10-30',now);
 assert.equal(stopped.series[0].until,'2026-10-29');
 assert.equal(projectWeek(stopped,'2026-10-26').events.length,1);
 assert.equal(projectWeek(stopped,'2026-11-02').events.length,0);
 assert.equal(historyEvents(stopped,'2026-10','all',now).length,5);
 assert.equal(historyEvents(stopped,'2026-10','done',now).length,0);
 assert.equal(stopped.events[0].snapshot.record.details[0].label,'Доска');
 assert.equal(data.series[0].until,'');
});
test('future moved exceptions are removed without regenerating their old past slot', () => {
 let data=base();const item=projectWeek(data,'2026-10-19').events[0];
 data=saveMove(data,item,'2026-11-03',600);
 const stopped=stopSeries(data,item,'2026-10-30',now);
 assert.equal(projectWeek(stopped,'2026-11-02').events.length,0);
 assert.equal(projectWeek(stopped,'2026-10-19').events.length,0);
 assert.ok(stopped.series[0].excludedDates.includes('2026-10-23'));
});
test('stopped recurring metadata remains stable after record and template edits', () => {
 const data=base(), item=projectWeek(data,'2026-10-26').events[0];
 const stopped=stopSeries(data,item,'2026-10-30',now);
 stopped.students[0].name='Новое имя';stopped.types[0].fields[0].label='Новый заголовок';
 const past=historyEvents(stopped,'2026-10','all',now).find(event=>event.date==='2026-10-02');
 assert.equal(past.snapshot.record.name,'Ученик'); assert.equal(past.snapshot.type.fields[0].label,'Тема');
});
test('ending repeats before they start creates no meetings and rejects retroactive cutoff', () => {
 const data=base();data.series[0].from='2026-11-06';
 const stopped=stopSeries(data,{seriesId:'weekly'},'2026-10-30',now);
 assert.equal(projectWeek(stopped,'2026-11-02').events.length,0);
 assert.throws(()=>stopSeries(data,{seriesId:'weekly'},'2026-10-29',now),/Прошлое/);
});
test('existing conducted events acquire a snapshot on migration without losing fields', () => {
 const data=base();data.events=[{...projectWeek(data,'2026-10-26').events[0],status:'done'}];
 const migrated=normalizeData(JSON.parse(JSON.stringify(data)));
 assert.equal(migrated.events[0].snapshot.record.name,'Ученик');
 assert.equal(migrated.events[0].fields.topic,'Тема');assert.equal(data.events[0].snapshot,undefined);
});
