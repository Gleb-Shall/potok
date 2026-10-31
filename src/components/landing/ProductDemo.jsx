import { useState } from 'preact/hooks';
import { EventCard } from '../EventCard.jsx';
import { EventEditor } from '../EventEditor.jsx';
import { EventDetails } from '../EventDetails.jsx';
import { MoveEditor } from '../MoveEditor.jsx';
import { TypeEditor } from '../TypeEditor.jsx';
import { RecordEditor } from '../RecordEditor.jsx';
import { StudentEditor } from '../StudentEditor.jsx';
import { Icon } from '../Icon.jsx';
import { dateLabel, initials } from '../UI.jsx';
import { addDays, mondayOf, todayISO } from '../../lib/domain.js';
import { allRecords, defaultTypes, projectWeek, restoreMove } from '../../lib/events.js';
import { setEventStatus } from '../../lib/event-history.js';

export function landingData() {
  const start=addDays(mondayOf(todayISO()),7);
  const types=defaultTypes();
  types[0].fields.push({id:'call',label:'Встреча',type:'url',showOnCard:true,showCompact:true,options:[]});
  return {version:2,revision:0,types,students:[{id:'anna',name:'Анна',subject:'Математика · ЕГЭ',rate:1800,color:'violet',contact:'anna@example.com',details:[{id:'board',label:'Доска',value:'https://example.com/board',type:'url',showOnCard:true}]}],records:[{id:'course',kind:'course',name:'Линейная алгебра',subtitle:'Семинар · университет',color:'blue',details:[{id:'teacher',label:'Преподаватель',value:'Ирина Волкова',type:'text'},{id:'room',label:'Аудитория',value:'204',type:'text'}]}],series:[],events:[
    {id:'algebra',typeId:'class',recordId:'course',title:'Линейная алгебра',date:start,anchorDate:start,start:600,duration:90,color:'blue',status:'planned',fields:{teacher:'Ирина Волкова',room:'204'},history:[]},
    {id:'lesson',typeId:'lesson',recordId:'anna',studentId:'anna',title:'Занятие с Анной',date:addDays(start,1),anchorDate:addDays(start,1),start:900,duration:60,color:'violet',status:'planned',fields:{topic:'Производные',rate:1800,call:'https://example.com/call'},history:[]},
    {id:'walk',typeId:'personal',title:'Прогулка у воды',date:addDays(start,2),anchorDate:addDays(start,2),start:1080,duration:60,color:'green',status:'planned',fields:{description:'Час без телефона'},history:[]},
  ]};
}
export function ProductDemo() {
  const [data,setData]=useState(landingData);
  const [tab,setTab]=useState('calendar');
  const [dialog,setDialog]=useState(null);
  const [dragging,setDragging]=useState('');
  const [over,setOver]=useState('');
  const [message,setMessage]=useState('Попробуй перенести занятие с Анной на другой день.');
  const [expanded,setExpanded]=useState({});
  const start=data.events.find(event=>event.id==='algebra')?.anchorDate || addDays(mondayOf(todayISO()),7);
  const days=[start,addDays(start,1),addDays(start,2)];
  const projection=projectWeek(data,start,3);
  const find=id=>data.events.find(event=>event.id===id);
  const save=(next,text)=>{setData(next);setDialog(null);if(text)setMessage(text);return true;};
  const saveRecord=(next,text,record)=>{setData(next);setMessage(text);const back=dialog.returnTo;setDialog(back?{...back,draft:{...back.draft,recordId:record.id,studentId:record.kind==='student'||dialog.kind==='student'?record.id:'',title:back.draft.title||record.name,color:record.color}}:null);return true;};
  const close=()=>setDialog(dialog?.returnTo||null);
  const newRecord=(category,draft)=>setDialog({kind:category==='student'?'student':'record',category,returnTo:{...dialog,draft}});
  const restore=event=>{try{save(restoreMove(data,event),'Перенос отменён. Событие снова на исходном месте.');}catch(error){setMessage(error.message);}};
  const stopDrag=()=>{setDragging('');setOver('');};
  const drop=(input,date)=>{input.preventDefault();const event=find(dragging);stopDrag();if(!event||event.date===date)return;if(event.originalDate===date){restore(event);return;}setDialog({kind:'move',event,date});};
  const open=id=>setDialog({kind:'detail',event:find(id)});
  const records=allRecords(data);
  return <div class="product-demo" id="try" data-ui>
    <div class="product-demo-bar"><div class="demo-workspace"><span class="demo-workspace-dot"/>Моё пространство <span>Пример</span></div><button class="demo-reset" onClick={()=>{setData(landingData());setExpanded({});setMessage('Пример восстановлен. Можно пробовать снова.');}}>Сбросить пример <Icon name="repeat"/></button></div>
    <div class="product-demo-tabs" role="tablist" aria-label="Возможности Потока">{[['calendar','Календарь'],['records','Записи'],['templates','Шаблоны']].map(([id,label])=><button key={id} role="tab" aria-selected={tab===id} aria-controls={`product-panel-${id}`} id={`product-tab-${id}`} onClick={()=>setTab(id)}>{label}</button>)}</div>
    <div role="tabpanel" id={`product-panel-${tab}`} aria-labelledby={`product-tab-${tab}`} class="product-demo-content">
      {tab==='calendar'&&<><div class="demo-calendar-title"><div><h2>Место для твоих планов</h2><span>{dateLabel(start)} — {dateLabel(days[2])}</span></div><button class="demo-add" onClick={()=>setDialog({kind:'event',date:start})}><Icon name="plus"/>Событие</button></div><div class="demo-calendar-grid">{days.map(date=><section key={date} data-demo-day={date} class={`demo-day ${over===date?'demo-day-over':''}`} onDragOver={input=>{if(dragging){input.preventDefault();input.dataTransfer.dropEffect='move';setOver(date);}}} onDragLeave={input=>{if(!input.currentTarget.contains(input.relatedTarget))setOver('');}} onDrop={input=>drop(input,date)}><header><span>{dateLabel(date,{weekday:'long'})}</span><strong>{Number(date.slice(8))}</strong></header><div class="demo-day-events">{projection.ghosts.filter(event=>event.date===date).map(event=><EventCard key={`ghost-${event.id}`} event={event} data={data} onOpen={open} canRestore={dragging===event.id} onRestoreDrop={()=>{stopDrag();restore(find(event.id));}}/>)}{projection.events.filter(event=>event.date===date).map(event=><EventCard key={event.id} event={event} data={data} onOpen={open} onToggle={id=>setExpanded(previous=>({...previous,[id]:!previous[id]}))} expanded={!!expanded[event.id]} isDragging={dragging===event.id} onDragStart={setDragging} onDragEnd={stopDrag}/>)}{over===date&&dragging&&<div class="demo-drop-place">Отпусти карточку здесь</div>}<button class="demo-add-slot" onClick={()=>setDialog({kind:'event',date})}><Icon name="plus"/>Добавить событие</button></div></section>)}</div></>}
      {tab==='records'&&<div class="demo-directory"><div class="demo-calendar-title"><div><h2>Общие сведения — рядом</h2><span>Измени запись: новые сведения появятся в связанных событиях.</span></div></div>{records.map(record=><button class="demo-record-row" key={record.id} onClick={()=>setDialog({kind:record.kind==='student'?'student':'record',record})}><span class={`record-initials color-${record.color}`}>{initials(record.name)}</span><span><strong>{record.name}</strong><small>{record.subject||record.subtitle}</small></span><span>{record.kind==='student'?'Ученик':'Предмет'}</span><Icon name="right"/></button>)}</div>}
      {tab==='templates'&&<div class="demo-directory"><div class="demo-calendar-title"><div><h2>Твои события, твои поля</h2><span>Открой шаблон и настрой видимость полей в карточке.</span></div></div>{data.types.map(type=><button class="demo-template-row" key={type.id} onClick={()=>setDialog({kind:'template',type})}><span>{type.icon}</span><strong>{type.name}</strong><small>{type.fields.filter(field=>!field.archived).map(field=>field.label).join(', ')||'Основные поля'}</small><Icon name="sliders"/></button>)}</div>}
    </div>
    <div class="product-demo-foot"><span role="status">{message}</span><span>Вымышленные данные · изменения только в этом примере</span></div>
    {dialog?.kind==='move'&&<MoveEditor data={data} event={dialog.event} date={dialog.date} onClose={()=>setDialog(null)} onSave={save} onAdvanced={draft=>setDialog({kind:'event',event:dialog.event,date:draft.date,draft:{start:draft.start}})}/>}
    {dialog?.kind==='detail'&&<EventDetails data={data} event={dialog.event} onClose={()=>setDialog(null)} onEdit={()=>setDialog({...dialog,kind:'event'})} onMove={()=>setDialog({...dialog,kind:'move'})} onStatus={status=>save(setEventStatus(data,dialog.event,status),'Статус события изменён')} onRecord={record=>setDialog({kind:'record',record})} onStudent={student=>setDialog({kind:'student',record:student})}/>}
    {dialog?.kind==='event'&&<EventEditor data={data} original={dialog.event} draft={dialog.draft} date={dialog.date||dialog.event?.date||start} typeId={dialog.event?.typeId||'personal'} onClose={close} onSave={save} onNewStudent={draft=>newRecord('student',draft)} onNewRecord={newRecord}/>}
    {dialog?.kind==='template'&&<TypeEditor data={data} original={dialog.type} onSave={save} onClose={()=>setDialog(null)}/>}
    {dialog?.kind==='record'&&<RecordEditor data={data} original={dialog.record} category={dialog.category} onSave={saveRecord} onClose={close}/>}
    {dialog?.kind==='student'&&<StudentEditor data={data} original={dialog.record} onSave={saveRecord} onClose={close}/>}
  </div>;
}
