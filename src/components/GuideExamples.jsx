import { useId, useState } from 'preact/hooks';
import { defaultTypes, moveEvent, restoreMove } from '../lib/events.js';
import { setEventStatus, unconfirmedEvents } from '../lib/event-history.js';
import { eventAppearance } from '../lib/state-appearance.js';
import { resolveRecordFields } from '../lib/record-field-links.js';
import { reportFields, reportMeasure, reportRows } from '../lib/statistics.js';
import { ActivityStatus, ActivityTime } from './EventListRow.jsx';
import { Button, Field, money } from './UI.jsx';

import { Icon } from './Icon.jsx';

const lesson = {id:'guide-lesson',title:'Занятие с Анной',typeId:'lesson',date:'2026-11-10',anchorDate:'2026-11-10',start:900,duration:60,status:'planned',fields:{},history:[]};
const workspace = {types:defaultTypes(),students:[],records:[],series:[],events:[lesson]};
const later = Date.parse('2026-11-10T16:05:00+03:00');
const laterWeek = 'Вт, 17 ноября · 15:00–16:00';

function TransferExample({defer = false}) {
  const [event,setEvent] = useState(lesson);
  const pending = event.status==='pending';
  const moved = event.date!==lesson.date;
  const change = () => {
    if (moved) {
      const restored = restoreMove({...workspace,events:[event]},event);
      setEvent(restored.events[0]);
    } else {
      setEvent(moveEvent(event,defer ? null : '2026-11-11',defer ? 900 : 960,60));
    }
  };
  return <>
    <p>{defer ? 'Отложи встречу, пока новое время неизвестно.' : 'Перенеси занятие этой недели на среду.'}</p>
    <div class="guide-example-slots guide-transfer-demo" aria-live="polite">
      <div><small>Эта неделя · Вт</small>
        {moved ? <span class="guide-slot-empty"><s>15:00–16:00</s><br/>Исходное время</span> :
          <div class="guide-event-sample"><strong>{event.title}</strong><span><ActivityTime start={event.start} duration={event.duration}/></span></div>}
      </div>
      <div><small>{defer ? 'Ждут новой даты' : 'Эта неделя · Ср'}</small>
        {moved ? <div class="guide-event-sample" key={event.date || 'pending'}><strong>{event.title}</strong>
          {pending ? <ActivityStatus appearance={eventAppearance(event)}/> : <span><ActivityTime start={event.start} duration={event.duration}/></span>}
        </div> : <span class="guide-slot-empty">{defer ? 'Очередь пуста' : 'Свободно'}</span>}
      </div>
      <div><small>Следующая встреча</small><strong>{event.title}</strong><span>{laterWeek}</span></div>
    </div>
    <Button onClick={change}>{moved ? 'Вернуть на место' : defer ? 'Отложить перенос' : 'Перенести на среду, 16:00'}</Button>
  </>;
}

function ConfirmationExample() {
  const [data,setData] = useState(workspace);
  const [event] = data.events;
  const waiting = unconfirmedEvents(data,later).length>0;
  return <>
    <p>Занятие закончилось. Выбери, состоялось ли оно.</p>
    <div class="guide-example-slots guide-journal-demo" aria-live="polite">
      {['Ждут подтверждения','Архив'].map((label,i)=><div key={label}>
        <small>{label}</small>
        {waiting===(i===0) ? <div class="guide-event-sample" key={event.status}>
          <strong>{event.title}</strong><span><ActivityTime start={event.start} duration={event.duration}/></span>
          <ActivityStatus appearance={eventAppearance(event,{now:later})}/>
        </div> : <span class="guide-slot-empty">{i===0 ? 'Очередь пуста' : 'Здесь появится итог занятия'}</span>}
      </div>)}
    </div>
    {waiting && <div class="guide-example-actions">
      <Button icon="check" onClick={()=>setData(setEventStatus(data,event,'done',later))}>Проведено</Button>
      <Button icon="close" onClick={()=>setData(setEventStatus(data,event,'cancelled',later))}>Отменено</Button>
    </div>}
  </>;
}

const contacts = {
  anna:{name:'Анна',initial:'А',contact:'anna@example.com',withName:'Анной'},
  ivan:{name:'Иван',initial:'И',contact:'ivan@example.com',withName:'Иваном'},
};
const contactField = mode => [{id:'contact',type:'text',source:{mode,fieldId:'record:contact'}}];

function ExampleChoice({label,value,options,onChange}) {
  const name = useId();
  return <fieldset class="guide-choice">
    <legend>{label}</legend>
    <div>{options.map(([id,text])=><label key={id}>
      <input class="sr-only" type="radio" name={name} value={id} checked={value===id} onChange={()=>onChange(id)}/>
      <span>{text}</span>
    </label>)}</div>
  </fieldset>;
}

function RecordExample({showModes = false}) {
  const [recordId,setRecordId] = useState('anna');
  const [mode,setMode] = useState('live');
  const [annaContact,setAnnaContact] = useState(contacts.anna.contact);
  const original = contacts[recordId];
  const record = recordId==='anna' ? {...original,contact:annaContact} : original;
  const source = mode==='copy' ? original : record;
  const values = resolveRecordFields(contactField(mode),{},source,mode);
  return <>
    <p>{showModes ? 'Измени контакт Анны и переключи способ подстановки, чтобы сравнить значения.' : 'Выбери ученика. Контакт из его записи сразу появится в занятии.'}</p>
    <ExampleChoice label={showModes ? 'Источник значения' : 'Связанная запись'} value={showModes ? mode : recordId}
      options={showModes ? [['live','Брать из записи'],['copy','Подставить при создании']] : [['anna','Анна'],['ivan','Иван']]}
      onChange={showModes ? setMode : setRecordId}/>
    <div class="guide-connection" data-linked-person={recordId}>
      <div class="guide-object">
        <small><Icon name="users"/>Запись ученика</small>
        <div class="guide-contact-name"><span aria-hidden="true">{record.initial}</span><strong>{record.name}</strong></div>
        {showModes ? <Field label="Контакт" value={annaContact} onChange={setAnnaContact}/> :
          <div class="guide-contact-value"><small>Контакт</small><span>{record.contact}</span></div>}
      </div>
      <div class="guide-connection-arrow" aria-hidden="true"><Icon name="arrow"/></div>
      <div class="guide-object guide-object-event" aria-live="polite">
        <small><Icon name="calendar"/>Вт · 15:00–16:00</small>
        <strong>Занятие с {record.withName}</strong>
        <div class="guide-contact-value"><small>{mode==='copy' ? 'Копия при создании' : 'Контакт из записи'}</small>
          <span key={values.contact}>{values.contact || 'Контакт не указан'}</span>
        </div>
      </div>
    </div>
  </>;
}

const reportData = {...workspace,events:[
  {...lesson,id:'guide-report-1',title:'Разбор задач',status:'done',fields:{rate:1500}},
  {...lesson,id:'guide-report-2',title:'Подготовка к экзамену',status:'done',fields:{rate:2400}},
  {...lesson,id:'guide-report-3',title:'Пробное занятие',status:'done',fields:{rate:0}},
  {...lesson,id:'guide-report-4',title:'Отменённое занятие',status:'cancelled',fields:{rate:2000}},
]};
const report = reportRows(reportData,'2026-11-01','2026-11-30');
const rate = reportFields(report).find(field=>field.id==='rate');
const highestRate = Math.max(...report.map(row=>row.values.rate));

function ReportExample() {
  const [operation,setOperation] = useState('sum');
  const {value} = reportMeasure(report,[rate],operation);
  return <>
    <p>Переключи способ расчёта стоимости проведённых занятий.</p>
    <ExampleChoice label="Как считать" value={operation} onChange={setOperation} options={[['sum','Сумма'],['average','Среднее']]}/>
    <div class="guide-example-result" aria-live="polite"><small>{operation==='sum' ? 'Итого за занятия' : 'В среднем за занятие'}</small><strong>{money(value)}</strong></div>
    <ul class="guide-example-breakdown">
      {report.map(({event,values})=><li key={event.id}><span>{event.title}</span><strong>{money(values.rate)}</strong>
        <i aria-hidden="true" style={{width:`${values.rate/highestRate*100}%`}}/></li>)}
    </ul>
  </>;
}

const examples = {
  move:TransferExample,
  linked:RecordExample,
  source:()=> <RecordExample showModes/>,
  confirm:ConfirmationExample,
  defer:()=> <TransferExample defer/>,
  report:ReportExample,
};

export function GuideExample({name}) {
  const [reset,setReset] = useState(0);
  const Example = examples[name];
  return <div class="guide-example">
    <header><strong><Icon name="play"/>Попробовать в примере</strong><Button kind="text-button" icon="refresh" onClick={()=>setReset(value=>value+1)}>Сначала</Button></header>
    <Example key={reset}/>
  </div>;
}
