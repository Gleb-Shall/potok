import { useId, useState } from 'preact/hooks';
import { defaultTypes, moveEvent, restoreMove } from '../lib/events.js';
import { setEventStatus, unconfirmedEvents } from '../lib/event-history.js';
import { eventAppearance } from '../lib/state-appearance.js';
import { resolveRecordFields } from '../lib/record-field-links.js';
import { reportFields, reportMeasure, reportRows } from '../lib/statistics.js';
import { ActivityStatus, ActivityTime } from './EventListRow.jsx';
import { Button, Field, money } from './UI.jsx';

import { Icon } from './Icon.jsx';
import { GuideTransferExample } from './GuideTransferExample.jsx';

const lesson = {id:'guide-lesson',title:'Занятие с Анной',typeId:'lesson',date:'2026-11-10',anchorDate:'2026-11-10',start:900,duration:60,status:'planned',fields:{},history:[]};
const workspace = {types:defaultTypes(),students:[],records:[],series:[],events:[lesson]};
const later = Date.parse('2026-11-10T16:05:00+03:00');
function DeferredTransferExample() {
  const [event,setEvent] = useState(lesson);
  const [selected,setSelected] = useState(false);
  const pending = event.status==='pending';
  const move = (date,start) => {
    setEvent(moveEvent(event,date,start,event.duration));
    setSelected(false);
  };
  const restore = () => {
    setEvent(restoreMove({...workspace,events:[event]},event).events[0]);
    setSelected(false);
  };
  const card = <button class="guide-event-sample guide-pick-card" type="button" aria-expanded={selected} onClick={()=>setSelected(value=>!value)}>
    <strong>{event.title}</strong>
    {pending ? <ActivityStatus appearance={eventAppearance(event)}/> : <span><ActivityTime start={event.start} duration={event.duration}/></span>}
  </button>;
  return <>
    <p>Открой карточку занятия и отложи перенос. Затем открой её в очереди, чтобы назначить новое время.</p>
    <div class="guide-example-slots" aria-live="polite">
      <div><small>Расписание</small>{pending ? <span class="guide-slot-empty">Исходное время освобождено</span> : card}</div>
      <div><small>Ждут новой даты</small>{pending ? card : <span class="guide-slot-empty">Очередь пуста</span>}</div>
    </div>
    {selected && <div class="guide-example-actions">{pending ? <>
      <Button onClick={()=>move('2026-11-11',960)}>Выбрать среду, 16:00</Button>
      <Button onClick={restore}>Вернуть на место</Button>
    </> : <Button onClick={()=>move(null,event.start)}>Отложить перенос</Button>}</div>}
  </>;
}

function ConfirmationExample() {
  const [data,setData] = useState(workspace);
  const [event] = data.events;
  const [selected,setSelected] = useState(false);
  const confirm = status => {setData(setEventStatus(data,event,status,later));setSelected(false);};
  const waiting = unconfirmedEvents(data,later).length>0;
  const Card = waiting ? 'button' : 'div';
  const cardProps = waiting ? {type:'button','aria-expanded':selected,onClick:()=>setSelected(value=>!value)} : {};
  return <>
    <p>Открой карточку занятия и отметь, состоялось ли оно.</p>
    <div class="guide-example-slots guide-journal-demo" aria-live="polite">
      {['Ждут подтверждения','Архив'].map((label,i)=><div key={label}>
        <small>{label}</small>
        {waiting===(i===0) ? <Card class={`guide-event-sample${waiting ? ' guide-pick-card' : ''}`} key={event.status} {...cardProps}>
          <strong>{event.title}</strong><span><ActivityTime start={event.start} duration={event.duration}/></span>
          <ActivityStatus appearance={eventAppearance(event,{now:later})}/>
        </Card> : <span class="guide-slot-empty">{i===0 ? 'Очередь пуста' : 'Здесь появится итог занятия'}</span>}
      </div>)}
    </div>
    {waiting && selected && <div class="guide-example-actions">
      <Button icon="check" onClick={()=>confirm('done')}>Проведено</Button>
      <Button icon="close" onClick={()=>confirm('cancelled')}>Отменено</Button>
    </div>}
  </>;
}

const contacts = {
  anna:{name:'Анна',initial:'А',contact:'anna@example.com'},
  ivan:{name:'Иван',initial:'И',contact:'ivan@example.com'},
};
const reviewEvent = {title:'Разбор задач',time:'Вт · 15:00–16:00'};
const consultationEvent = {title:'Консультация',time:'Пт · 17:00–17:30'};
const contactField = {id:'contact',type:'text',source:{fieldId:'record:contact'}};

function ExampleChoice({label,value,options,onChange,className = ''}) {
  const name = useId();
  return <fieldset class={`guide-choice ${className}`}>
    <legend>{label}</legend>
    <div>{options.map(([id,text])=><label key={id}>
      <input class="sr-only" type="radio" name={name} value={id} checked={value===id} onChange={()=>onChange(id)}/>
      <span class="guide-choice-option">{text}</span>
    </label>)}</div>
  </fieldset>;
}

function RecordExample({variant = 'linked'}) {
  const configureSource = variant==='source';
  const multipleEvents = variant==='shared';
  const chooseRecord = variant==='linked';
  const [recordId,setRecordId] = useState('anna');
  const [useRecord,setUseRecord] = useState(true);
  const [annaContact,setAnnaContact] = useState(contacts.anna.contact);
  const [eventContact,setEventContact] = useState('');
  const record = chooseRecord ? contacts[recordId] : {...contacts.anna,contact:annaContact};
  const events = multipleEvents ? [reviewEvent,consultationEvent] : [reviewEvent];
  const {contact} = resolveRecordFields([contactField],{},record);
  const instructions = {
    linked:'Переключи запись между Анной и Иваном. Имя и контакт изменятся в одной и той же карточке события.',
    shared:'Измени контакт в записи Анны. «Разбор задач» и «Консультация» получат новый адрес из этой записи.',
    source:'Выбери, откуда берётся контакт. При ручном заполнении у события будет своё значение.',
  };
  return <>
    <p>{instructions[variant]}</p>
    {configureSource && <ExampleChoice label="Источник значения" value={useRecord ? 'record' : 'event'} onChange={value=>setUseRecord(value==='record')}
      options={[['record','Контакт из записи'],['event','Заполнять в событии']]}/>}
    <div class={`guide-connection${multipleEvents ? ' guide-connection-many' : ''}`}>
      {!chooseRecord ? <div class="guide-object">
        <small>Запись ученика</small>
        <strong>{record.name}</strong>
        <Field label="Контакт" value={annaContact} onChange={setAnnaContact}/>
      </div> : <ExampleChoice label="Связанная запись" value={recordId} className="guide-contact-picker" onChange={setRecordId}
        options={Object.entries(contacts).map(([id,person])=>[id,<>
          <span class="guide-contact-initial" aria-hidden="true">{person.initial}</span>
          <span><strong>{person.name}</strong><small>{person.contact}</small></span>
        </>])}/>}
      <div class={`guide-connection-arrow${multipleEvents ? ' guide-connection-branch' : ''}`} aria-hidden="true">
        <Icon name="arrow"/>
        {multipleEvents && <svg viewBox="0 0 36 100" preserveAspectRatio="none" fill="none">
          <path d="M0 50H10M10 50C22 50 14 25 27 25H36M10 50C22 50 14 75 27 75H36"
            stroke="currentColor" vector-effect="non-scaling-stroke"/>
        </svg>}
      </div>
      <div class="guide-event-preview">
        <small class="guide-event-preview-label">{multipleEvents ? 'Связанные события' : 'Карточка события'}</small>
        <div class="guide-event-preview-list" aria-live="polite">
          {events.map(event=><article class="guide-object guide-object-event" key={event.title}>
              <small>{event.time}</small>
              <strong>{event.title}</strong>
              {chooseRecord && <small><Icon name="users"/>{record.name}</small>}
              {useRecord ? <div class="guide-contact-value"><small>Контакт из записи</small>
                <span key={contact}>{contact || 'Контакт не указан'}</span>
              </div> : <Field label="Контакт в событии" value={eventContact} onChange={setEventContact}/>}
            </article>)}
        </div>
      </div>
    </div>
  </>;
}

const reportData = {...workspace,events:[
  {...lesson,id:'guide-report-1',recordId:'anna',title:'Разбор задач',status:'done',fields:{rate:1500}},
  {...lesson,id:'guide-report-2',recordId:'anna',title:'Подготовка к экзамену',status:'done',fields:{rate:2400}},
  {...lesson,id:'guide-report-3',recordId:'ivan',title:'Пробное занятие',status:'done',fields:{rate:0}},
  {...lesson,id:'guide-report-4',title:'Отменённое занятие',status:'cancelled',fields:{rate:2000}},
]};
const report = reportRows(reportData,'2026-11-01','2026-11-30');
const rate = reportFields(report).find(field=>field.id==='rate');
const highestRate = Math.max(...report.map(row=>row.values.rate));

function ReportExample() {
  const [operation,setOperation] = useState('sum');
  const [recordId,setRecordId] = useState('');
  const entries = recordId ? report.filter(row=>row.recordId===recordId) : report;
  const {value} = reportMeasure(entries,[rate],operation);
  return <>
    <p>Выбери ученика и способ расчёта. Итог и список проведённых занятий обновятся вместе.</p>
    <div class="guide-example-actions">
      <ExampleChoice label="Запись" value={recordId} onChange={setRecordId} options={[['','Все'],['anna','Анна'],['ivan','Иван']]}/>
      <ExampleChoice label="Как считать" value={operation} onChange={setOperation} options={[['sum','Сумма'],['average','Среднее']]}/>
    </div>
    <div class="guide-example-result" aria-live="polite"><small>{operation==='sum' ? 'Итого за занятия' : 'В среднем за занятие'}</small><strong>{money(value)}</strong></div>
    <ul class="guide-example-breakdown">
      {entries.map(({event,values})=><li key={event.id}><span>{event.title}</span><strong>{money(values.rate)}</strong>
        <i aria-hidden="true" style={{width:`${values.rate/highestRate*100}%`}}/></li>)}
    </ul>
  </>;
}

const examples = {
  move:()=> <GuideTransferExample lesson={lesson} workspace={workspace}/>,
  linked:RecordExample,
  sharedRecord:()=> <RecordExample variant="shared"/>,
  source:()=> <RecordExample variant="source"/>,
  confirm:ConfirmationExample,
  defer:DeferredTransferExample,
  report:ReportExample,
};

export function GuideExample({name}) {
  const [reset,setReset] = useState(0);
  const Example = examples[name];
  return <section class="guide-example" aria-label="Практика на примере">
    <header><div><h3>Попробуй сам</h3><small>Учебные данные</small></div><Button kind="text-button" icon="refresh" onClick={()=>setReset(value=>value+1)}>Сначала</Button></header>
    <div class="guide-demo"><Example key={reset}/></div>
  </section>;
}
