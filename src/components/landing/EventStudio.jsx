import { useEffect, useRef, useState } from 'preact/hooks';
import { EventCard } from '../EventCard.jsx';
import { Field, Colors } from '../UI.jsx';
import { Icon } from '../Icon.jsx';
import { minutesToTime, timeToMinutes } from '../../lib/domain.js';
import { eventEnd, updateTiming } from '../../lib/timing.js';
import { saveEvent } from '../../lib/events.js';
import { useMotionVisibility } from '../../hooks/useMotionVisibility.js';
import { landingData } from './demo-data.js';

const PRESETS = {
  lesson:{ label:'Занятие', title:'Занятие с Анной', color:'violet', recordId:'anna', studentId:'anna', topic:'Производные' },
  class:{ label:'Учёба', title:'Линейная алгебра', color:'blue', recordId:'course', room:'Аудитория 204' },
  personal:{ label:'Для себя', title:'Прогулка у воды', color:'green', location:'Набережная' },
};
function initial(event) {
  const data = landingData();
  if (event) return { ...PRESETS[event.typeId], ...event, ...event.fields, start: minutesToTime(event.start), end: minutesToTime(event.start + event.duration), showTopic:true, showCall:true };
  return { ...PRESETS.lesson, typeId:'lesson', date:data.events[1].date, start:'15:00', duration:60, end:'16:00', showTopic:true, showCall:true };
}

export function EventStudio({ data: providedData, selectedEvent, onApply, onPreview } = {}) {
  const [localBase] = useState(() => ({...landingData(),events:[]}));
  const base = providedData || localBase;
  const [values,setValues] = useState(() => initial(selectedEvent));
  const [saved,setSaved] = useState(false);
  const [error,setError] = useState('');
  const timer = useRef(null);
  const motion = useMotionVisibility();
  useEffect(() => () => clearTimeout(timer.current),[]);
  const change = patch => { setSaved(false); setError(''); setValues(previous => ({...previous,...patch})); };
  const types = base.types.map(type => ({...type,fields:type.fields.map(field => ({...field,showOnCard:field.id==='topic'?values.showTopic:field.id==='call'?values.showCall:field.id==='rate'?false:field.showOnCard}))}));
  const data = {...base,types};
  let start=900;
  try { start=timeToMinutes(values.start); } catch { /* Keep incomplete input editable. */ }
  const event = { ...selectedEvent, id:selectedEvent?.id || 'studio', typeId:values.typeId, title:values.title, date:values.date, start, duration:Number(values.duration)||60, color:values.color, recordId:values.recordId, studentId:values.studentId, status:'planned', busy:true, fields:{ ...selectedEvent?.fields, topic:values.topic||'', room:values.room||'', location:values.location||'', call:values.showCall?'https://example.com/call':'' } };
  useEffect(() => { onPreview?.(event); }, [values]);
  const detailKey = values.typeId==='lesson'?'topic':values.typeId==='class'?'room':'location';
  const detailLabel = values.typeId==='lesson'?'Тема встречи':values.typeId==='class'?'Аудитория':'Место';
  const submit = input => {
    input.preventDefault();
    try {
      saveEvent(base,{values:{...event,start:timeToMinutes(values.start),duration:Number(values.duration)},original:selectedEvent || null,scope:'one',repeat:null});
      onApply?.({ event:{...event,start:timeToMinutes(values.start)}, types });
      setSaved(true); setError(''); clearTimeout(timer.current); timer.current=setTimeout(() => setSaved(false),2400);
    } catch (failure) { setError(failure.message); }
  };
  return <section class={`event-studio motion-scene ${motion.active?'scene-active':''}`} id="editor" ref={motion.ref}>
    <div class="experiment-heading"><h2>Настрой карточку.</h2><p>Выбери поля, цвет и время.<br/>Карточка обновится сразу.</p></div>
    <div class="studio-stage" data-ui><form class="studio-form" onSubmit={submit} aria-label="Пример редактора события">
      <div class="studio-presets" role="group" aria-label="Вид события">{Object.entries(PRESETS).map(([id,preset]) => <button type="button" key={id} aria-pressed={values.typeId===id} onClick={() => change({...preset,typeId:id,studentId:preset.studentId||'',recordId:preset.recordId||''})}>{preset.label}</button>)}</div>
      <Field label="Название" value={values.title} required maxLength={100} onChange={title => change({title})}/>
      <div class="studio-times"><Field label="Начало" type="time" value={values.start} required onChange={value => change(updateTiming(values,'start',value))}/><Field label="Конец" type="time" value={values.end} required onChange={value => change(updateTiming(values,'end',value))}/><Field label="Минут" type="number" value={values.duration} min="5" max="720" required onChange={value => change(updateTiming(values,'duration',value))}/></div>
      <Field label={detailLabel} value={values[detailKey]||''} maxLength={120} onChange={value => change({[detailKey]:value})}/>
      {values.typeId==='lesson' && <div class="studio-visibility"><span>Показать в карточке</span><div>{[['showTopic','Тема'],['showCall','Ссылка на встречу']].map(([key,label]) => <button type="button" key={key} aria-pressed={values[key]} onClick={() => change({[key]:!values[key]})}><Icon name={values[key]?'check':'plus'}/>{label}</button>)}</div></div>}
      <Colors value={values.color} onChange={color => change({color})}/>
      {error && <p class="studio-error" role="alert">{error}</p>}
      <button class={`studio-save ${saved?'studio-saved':''}`} type="submit"><Icon name={saved?'check':'arrow'}/>{saved?'Готово. Карточка обновлена':'Применить в примере'}</button>
    <a class="studio-preview-jump" href="#studio-preview">Посмотреть карточку <Icon name="down"/></a>
    </form><div class="studio-canvas" id="studio-preview"><svg class="studio-orbits" viewBox="0 0 600 650" fill="none" aria-hidden="true"><ellipse cx="300" cy="325" rx="250" ry="100"/><ellipse cx="300" cy="325" rx="250" ry="100" transform="rotate(60 300 325)"/><ellipse cx="300" cy="325" rx="250" ry="100" transform="rotate(120 300 325)"/></svg><div class={`studio-live-card ${saved?'studio-card-saved':''}`}><EventCard data={data} event={event} preview expanded/></div><div class="studio-time-strip" aria-hidden="true"><span>{values.start||'15:00'}</span><i/><span>{eventEnd(values.start,values.duration)||minutesToTime(start+60)}</span></div></div></div>

  </section>;
}
