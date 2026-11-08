import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultTypes, eventFields, saveEvent } from '../src/lib/events.js';
import { setEventStatus } from '../src/lib/event-history.js';
import { recordFieldCatalog } from '../src/lib/record-field-links.js';
import { eventStatistics, matchesReportFilter, reportFields, reportGroups, reportMeasure, reportRows } from '../src/lib/statistics.js';

const template={id:'training',name:'Тренировка',recordKind:'Хобби',fields:[
  {id:'link',label:'План',type:'url',required:true,source:{fieldId:'detail:plan',mode:'live'}},
  {id:'distance',label:'Расстояние',type:'number',metric:true,metricUnit:'км',source:{fieldId:'detail:route',mode:'copy'}},
]};
const record={id:'record',name:'Бег',kind:'Хобби',details:[
  {id:'plan',label:'План',type:'url',value:'https://example.com/old'},
  {id:'route',label:'Маршрут',type:'number',value:'5'},
]};
const data=()=>({types:[...defaultTypes(),template],students:[],records:[structuredClone(record)],series:[],events:[]});
const values={typeId:'training',recordId:'record',title:'Бег',date:'2026-11-07',start:600,duration:60,status:'planned',fields:{}};

test('custom records supply live and copied values and completion freezes the source',()=>{
  let workspace=saveEvent(data(),{values});
  const [event]=workspace.events;
  assert.deepEqual(event.fields,{distance:5});
  assert.deepEqual(eventFields(workspace,event),{distance:5,link:'https://example.com/old'});
  assert.ok(recordFieldCatalog(workspace.records,'Хобби').some(field=>field.id==='detail:route'));
  workspace.records[0].details[0].value='https://example.com/new';
  workspace.records[0].details[1].value='12';
  assert.deepEqual(eventFields(workspace,event),{distance:5,link:'https://example.com/new'});
  assert.equal(eventFields(workspace,{...event,fields:{...event.fields,link:'https://example.com/override'}}).link,'https://example.com/override');
  workspace=setEventStatus(workspace,event,'done');
  workspace.records[0].details[0].value='https://example.com/later';
  assert.equal(eventFields(workspace,workspace.events[0]).link,'https://example.com/new');
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
