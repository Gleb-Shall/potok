import {mkdirSync,writeFileSync} from 'node:fs';
import {defaultTypes} from '../src/lib/events.js';
const date=new Date();date.setUTCHours(12,0,0,0);
date.setUTCDate(date.getUTCDate()-((date.getUTCDay()+6)%7));
const start=date.toISOString().slice(0,10),colors=['violet','blue','green','peach','pink'];
const events=[];
for(let day=0;day<7;day++) for(let slot=0;slot<(day<5?6:5);slot++) {
  const current=new Date(date);current.setUTCDate(date.getUTCDate()+day);
  const iso=current.toISOString().slice(0,10),id=`bench-${day}-${slot}`;
  events.push({id,typeId:'personal',title:['Планирование','Работа над проектом','Занятие','Встреча','Практика','Время для себя'][slot],date:iso,anchorDate:iso,start:[480,570,660,780,870,960][slot],duration:60,status:'planned',busy:true,color:colors[(day+slot)%5],fields:{},notes:'Тестовое событие. Личных данных нет.',history:[]});
}
const fixture={version:2,revision:0,students:[],records:[],types:defaultTypes(),series:[],events,benchmark:{start,eventCount:events.length,timezone:'Europe/Moscow',window:[1280,800],hourHeight:76}};
mkdirSync('benchmarks/fixtures',{recursive:true});mkdirSync('apps/flutter_calendar/assets',{recursive:true});
const json=JSON.stringify(fixture,null,2)+'\n';
writeFileSync('benchmarks/fixtures/calendar.json',json);writeFileSync('apps/flutter_calendar/assets/calendar.json',json);
console.log(`Shared fixture: ${events.length} events, week ${start}.`);
