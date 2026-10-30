import { useState } from 'preact/hooks';
import { EventCard } from './EventCard.jsx';
import { Icon } from './Icon.jsx';
import { recordKind, RECORD_KINDS } from '../lib/events.js';
import { todayISO } from '../lib/domain.js';

export function TemplateTile({ type, data, onEdit, onCopy, onArchive, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const fields=type.fields.filter(field=>!field.archived);
  const countLabel=new Intl.PluralRules('ru').select(fields.length);
  const fieldWord={one:'поле',few:'поля',many:'полей',other:'полей'}[countLabel];
  const labels={lesson:'Занятие с учеником',class:'Линейная алгебра',personal:'Время для себя'};
  const event={id:'template-preview',typeId:type.id,title:labels[type.id]||type.titleLabel||'Название события',date:todayISO(),start:900,duration:60,color:type.color,status:'planned',fields:Object.fromEntries(fields.map(field=>[field.id,field.type==='checkbox'?true:field.type==='number'?1500:field.type==='url'?'https://example.com':field.type==='date'?todayISO():field.type==='multiselect'?field.options.slice(0,2):field.type==='select'?field.options[0]||'Вариант':field.label==='Тема'?'Производные':'Пример значения']))};
  return <article class={`template-gallery-card ${type.archived?'archived-type':''}`}><header><span class={`template-symbol color-${type.color}`}>{type.icon}</span><div><h3>{type.name}</h3><span>{fields.length} {fieldWord} · {recordKind(type)?RECORD_KINDS[recordKind(type)]||'Связанная запись':'Без связи с записью'}</span></div><details class="tile-actions-menu"><summary aria-label={`Другие действия с шаблоном «${type.name}»`}><Icon name="more"/></summary><div><button onClick={onCopy}><Icon name="plus"/>Создать копию</button><button onClick={onArchive}><Icon name="history"/>{type.archived?'Вернуть из архива':'В архив'}</button><button class="danger-text" onClick={onDelete}><Icon name="trash"/>Удалить шаблон</button></div></details></header>
    <div class="template-gallery-preview"><span class="preview-caption">В КАЛЕНДАРЕ</span><EventCard event={event} data={data} preview expanded={expanded}/><button type="button" class="template-preview-toggle" onClick={()=>setExpanded(!expanded)}>{expanded?'Свернуть пример':'Раскрыть пример'} <Icon name={expanded?'shrink':'expand'}/></button></div>
    <div class="template-gallery-fields">{fields.slice(0,3).map(field=><span key={field.id}>{field.label}{field.required&&' *'}</span>)}{fields.length>3&&<span>+{fields.length-3}</span>}{!fields.length&&<span>Основные поля события</span>}</div>
    <button class="template-configure" onClick={onEdit}><Icon name="sliders"/>Настроить поля и вид <Icon name="arrow"/></button>
  </article>;
}
