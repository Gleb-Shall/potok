import test from 'node:test';
import assert from 'node:assert/strict';
import { clearEventArchive, defaultTypes, deleteRecordTemplate, eventFields, normalizeData, projectWeek, recordKinds, saveEvent, saveRecord, saveRecordType, saveType, setTemplateArchived } from '../src/lib/events.js';
import { eventLinks } from '../src/lib/links.js';
import { setEventStatus } from '../src/lib/event-history.js';
import { recordFieldCatalog, recordTypeFields } from '../src/lib/record-field-links.js';
import { eventStatistics, matchesReportFilter, reportFields, reportGroups, reportMeasure, reportRows } from '../src/lib/statistics.js';

const template={id:'training',name:'Тренировка',recordKind:'Хобби',fields:[
  {id:'link',label:'План',type:'url',required:true,source:{fieldId:'detail:plan',mode:'live'}},
  {id:'distance',label:'Расстояние',type:'number',metric:true,metricUnit:'км',source:{fieldId:'detail:route',mode:'live'}},
]};
const record={id:'record',name:'Бег',kind:'Хобби',details:[
  {id:'plan',label:'План',type:'url',value:'https://example.com/old'},
  {id:'route',label:'Маршрут',type:'number',value:'5'},
]};
const data=()=>({types:[...defaultTypes(),template],students:[],records:[structuredClone(record)],series:[],events:[]});
const values={typeId:'training',recordId:'record',title:'Бег',date:'2026-11-07',start:600,duration:60,status:'planned',fields:{}};

test('changes formats for empty fields without carrying the old empty representation forward',()=>{
  const workspace=data();
  const lesson=workspace.types[0];
  workspace.events=[{typeId:lesson.id,fields:{topic:'',rate:0}}];
  workspace.series=[{typeId:lesson.id,fields:{topic:[]}}];
  const changed={...lesson,fields:[{...lesson.fields[0],type:'multiselect',options:['Практика']},lesson.fields[1]]};
  const saved=saveType(workspace,changed);
  assert.deepEqual(saved.events[0].fields,{rate:0});
  assert.deepEqual(saved.series[0].fields,{});
  assert.throws(()=>saveType(workspace,{...changed,fields:[changed.fields[0],{...lesson.fields[1],type:'text'}]}),/значения другого формата/);
});

test('custom records supply live values and completion freezes the source',()=>{
  let workspace=saveEvent(data(),{values});
  const [event]=workspace.events;
  assert.deepEqual(event.fields,{});
  assert.deepEqual(eventFields(workspace,event),{distance:5,link:'https://example.com/old'});
  assert.ok(recordFieldCatalog(workspace.records,'Хобби').some(field=>field.id==='detail:route'));
  workspace.records[0].details[0].value='https://example.com/new';
  workspace.records[0].details[1].value='12';
  assert.deepEqual(eventFields(workspace,event),{distance:12,link:'https://example.com/new'});
  assert.equal(eventFields(workspace,{...event,fields:{...event.fields,link:'https://example.com/override'}}).link,'https://example.com/override');
  workspace=setEventStatus(workspace,event,'done');
  workspace.records[0].details[0].value='https://example.com/later';
  assert.equal(eventFields(workspace,workspace.events[0]).link,'https://example.com/new');
});

test('legacy copy sources become live and stored values and historical blanks stay intact',()=>{
  const raw={...data(),version:2};
  const legacyType={...template,fields:template.fields.map(field=>field.id==='distance'
    ? {...field,source:{...field.source,mode:'copy'}} : field)};
  raw.types=[...defaultTypes(),legacyType];
  raw.events=[
    {...values,id:'stored',status:'planned',fields:{distance:5}},
    {...values,id:'historical',status:'done',snapshot:{type:legacyType,record}},
  ];
  const workspace=normalizeData(raw);
  workspace.records[0].details[1].value='12';
  const [stored,historical]=workspace.events;
  assert.equal(eventFields(workspace,stored).distance,5);
  assert.equal(eventFields(workspace,historical).distance,undefined);
  const created=saveEvent(workspace,{values:{...values,date:'2026-11-08'}}).events.at(-1);
  assert.deepEqual(created.fields,{});
  assert.equal(eventFields(workspace,created).distance,12);
});

test('statistics uses each completed event amount and keeps missing amounts distinct from zero',()=>{
  const workspace=data();
  workspace.events=[0,1500,2000,''].map((rate,i)=>({...values,id:String(i),typeId:'lesson',status:'done',fields:{rate}}));
  workspace.events.push({...values,id:'cancelled',typeId:'lesson',status:'cancelled',fields:{rate:9000}});
  const report=eventStatistics(workspace,'2026-11','record');
  assert.equal(report.entries.length,4);
  assert.equal(report.minutes,240);
  assert.equal(report.metrics[0].total,3500);
  assert.equal(report.metrics[0].count,3);
  assert.equal(report.metrics[0].missing,1);
});

test('custom report filters completed events by actual date and measures arbitrary fields',()=>{
  const workspace=data();
  const type=workspace.types.at(-1);
  type.fields.push({id:'effort',label:'Нагрузка',type:'number'}, {id:'tags',label:'Метки',type:'multiselect'}, {id:'indoors',label:'В помещении',type:'checkbox'});
  workspace.events=[0,4,''].map((effort,i)=>({...values,id:String(i),status:'done',start:600+i,fields:{
    effort,tags:i===0?['А','Б']:['А'],indoors:i!==0,
  }}));
  workspace.events.push({...workspace.events[0],id:'outside',date:'2026-11-08'}, {...workspace.events[1],id:'cancelled',status:'cancelled'});
  const rows=reportRows(workspace,'2026-11-07','2026-11-07');
  assert.deepEqual(rows.map(row=>row.event.id),['2','1','0']);
  const fields=Object.fromEntries(reportFields(rows).map(field=>[field.id,field]));
  assert.deepEqual(reportMeasure(rows,[fields.effort],'sum'),{value:4,missing:1});
  assert.deepEqual(reportMeasure(rows,[fields.effort],'average'),{value:2,missing:1});
  assert.deepEqual(rows.filter(row=>matchesReportFilter(row,fields.indoors,{operator:'equals',first:'false'})).map(row=>row.event.id),['0']);
  assert.deepEqual(rows.filter(row=>matchesReportFilter(row,fields.effort,{operator:'range',first:'0',last:'0'})).map(row=>row.event.id),['0']);
  assert.deepEqual(reportGroups(rows,fields.tags.key,new Map(),fields.tags).map(({label,rows})=>[label,rows.length]),[['А',3],['Б',1]]);
  assert.equal(reportMeasure(rows,[],'events').value,3);
});

test('custom reports separate historical units after a template changes',()=>{
  const workspace=data();
  const historical=structuredClone(template);
  workspace.types.at(-1).fields=template.fields.map(field=>field.id==='distance'?{...field,metricUnit:'м'}:field);
  workspace.events=[
    {...values,id:'historical',status:'done',fields:{distance:5},snapshot:{type:historical,record}},
    {...values,id:'current',status:'done',fields:{distance:5000}},
  ];
  const rows=reportRows(workspace,'2026-11-07','2026-11-07');
  const distances=reportFields(rows).filter(field=>field.id==='distance');
  assert.deepEqual(new Map(distances.map(field=>[field.unit,reportMeasure(rows,[field],'sum').value])),new Map([['км',5],['м',5000]]));
});

test('record type definitions are available before records exist and guard event links',()=>{
  const workspace=saveRecordType({...data(),types:defaultTypes(),records:[]},'Хобби',[{id:'plan',label:'План',type:'url'}]);
  assert.deepEqual(recordTypeFields(workspace,'Хобби').find(field=>field.id==='detail:plan'),{id:'detail:plan',label:'План',type:'url'});
  const input={...template,fields:[template.fields[0]]};
  const linked=saveType(workspace,input);
  assert.throws(()=>saveRecordType(linked,'Хобби',[]),/используется в шаблоне/);
  assert.throws(()=>saveType(workspace,{...input,recordKind:'any'}),/конкретный шаблон/);
  assert.throws(()=>saveType(workspace,{...input,fields:[{...input.fields[0],type:'text'}]}),/источник из выбранного шаблона/);
  const other={...record,id:'other',kind:'project'};
  assert.throws(()=>saveEvent({...linked,records:[other]},{values:{...values,recordId:other.id}}),/не подходит/);
  const second={...record,id:'second',details:[{id:'plan',label:'План',type:'url',value:'https://example.com/second'}]};
  const withRecords={...linked,records:[record,second]};
  const scheduled=saveEvent(withRecords,{values:{...values,recordId:second.id}});
  assert.equal(eventFields(scheduled,scheduled.events[0]).link,'https://example.com/second');
});

test('record template links and choices are inherited with their formats and current options',()=>{
  const definitions=[
    {id:'plan',label:'Доска',type:'url'},
    {id:'level',label:'Уровень',type:'select',options:['Начальный','Средний']},
  ];
  let workspace=saveRecordType({...data(),types:defaultTypes(),records:[]},'Хобби',definitions);
  workspace=saveType(workspace,{...template,fields:[
    {id:'board',label:'Открыть доску',type:'url',source:{fieldId:'detail:plan'}},
    {id:'level',label:'Уровень',type:'select',options:[],source:{fieldId:'detail:level'}},
  ]});
  workspace=saveRecord(workspace,{...record,details:[
    {id:'plan',label:'Доска',type:'url',value:'example.com/board'},
    {...definitions[1],value:'Средний'},
  ]});
  const created=saveEvent(workspace,{values});
  const [event]=created.events;
  assert.deepEqual(eventFields(created,event),{board:'https://example.com/board',level:'Средний'});
  assert.equal(eventLinks(created.types.at(-1).fields,eventFields(created,event))[0].label,'Открыть доску');
  const updated=saveRecordType(created,'Хобби',[definitions[0],{...definitions[1],options:['Начальный','Продвинутый']}]);
  assert.deepEqual(updated.types.at(-1).fields[1].options,['Начальный','Продвинутый']);
  assert.equal(eventFields(updated,event).level,'Средний');
});

test('deleting a record template preserves dependencies and removes unused built-ins from the picker',()=>{
  const workspace={...data(),types:defaultTypes(),records:[]};
  assert.throws(()=>deleteRecordTemplate(workspace,'student'),/используется/);
  const independent={...workspace,types:workspace.types.filter(type=>type.id!=='lesson')};
  const deleted=deleteRecordTemplate(independent,'student');
  assert.equal(recordKinds(deleted).includes('student'),false);
  assert.equal(recordKinds(saveRecordType(deleted,'student',[])).includes('student'),true);
  assert.throws(()=>deleteRecordTemplate({...independent,students:[{id:'a',name:'Анна'}]},'student'),/используется/);
});

test('record template archive is reversible, deletion freezes its events and series until the archive is cleaned',()=>{
  const workspace = {...data(),students:[{id:'s',name:'Анна',subject:'Математика'}]};
  const lesson = {id:'meeting',typeId:'lesson',studentId:'s',date:'2026-11-07',start:600,duration:60,status:'done',fields:{rate:1200}};
  workspace.events=[lesson,{...lesson,id:'other',typeId:'personal',studentId:'',status:'planned'}];
  workspace.series=[{...lesson,id:'repeat',from:'2026-11-07',weekday:6}];
  const archived=setTemplateArchived(workspace,'records','student',true);
  assert.equal(recordKinds(archived).includes('student'),false);
  assert.equal(archived.students.length,1);
  assert.equal(recordKinds(setTemplateArchived(archived,'records','student',false)).includes('student'),true);
  const deleted=deleteRecordTemplate(archived,'student',{removeRecords:true});
  assert.deepEqual(deleted.students,[]);
  assert.deepEqual(deleted.series,[]);
  assert.deepEqual(projectWeek(deleted,'2026-11-07').events.map(event=>event.id),['other']);
  assert.equal(deleted.types.find(type=>type.id==='lesson').recordKind,'');
  assert.deepEqual(deleted.eventArchive.map(item=>[item.id,item.archiveKind,item.snapshot.record.name]),[['meeting','event','Анна'],['repeat','series','Анна']]);
  assert.equal(reportRows(deleted,'2026-11-01','2026-11-30').length,1);
  const partlyCleared=clearEventArchive(deleted,deleted.eventArchive[0]);
  assert.deepEqual(partlyCleared.eventArchive.map(item=>item.id),['repeat']);
  assert.deepEqual(clearEventArchive(partlyCleared).eventArchive,[]);
});
