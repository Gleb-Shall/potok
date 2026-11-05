import { useState } from 'preact/hooks';
import { EventPlacePreview } from './EventPlacePreview.jsx';
import { EventReminder } from './EventReminder.jsx';
import { ActionMenu } from './ActionMenu.jsx';
import { Modal, Button, dateLabel } from './UI.jsx';
import { minutesToTime } from '../lib/domain.js';
import { eventType, allRecords, getStudent, getRecord, eventTitle, fieldDisplay, RECORD_KINDS } from '../lib/events.js';
import { LinkedValue, LinkedText, ExternalLink } from './LinkedValue.jsx';
import { recordLinks } from '../lib/links.js';
import { eventHasEnded } from '../lib/event-history.js';
import { Icon } from './Icon.jsx';

export function EventDetails({ data, event, onEdit, onMove, onStatus, onStudent, onRecord, onClose, onDelete, onStop, onReminder, onRemoveReminder, pushReady, onEnablePush, now = Date.now() }) {
  const [mapExpanded,setMapExpanded]=useState(false);
  const type = eventType(data, event);
  const student = getStudent(data, event.studentId);
  const record = getRecord(data, event);
  const labels = { planned: 'Запланировано', done: 'Проведено', pending: 'Ждёт переноса', cancelled: 'Отменено' };
  return <Modal title={eventTitle(data, event)} eyebrow={type.name.toLocaleUpperCase('ru')} subtitle={record?.kind === 'student' && record.name !== eventTitle(data, event) ? `Ученик: ${record.name}` : undefined} onClose={onClose} className={`product-dialog event-inspector ${mapExpanded?'has-expanded-map':''}`} fullscreen={mapExpanded} onEscape={()=>mapExpanded?setMapExpanded(false):onClose()} panel>
    <div class="inspector-content"><div class="inspector-toolbar"><label class="event-status-control"><span class={`event-status-dot status-${event.status}`}/><select aria-label="Статус события" value={event.status} onChange={input => onStatus(input.currentTarget.value)}>{Object.entries(labels).map(([id,label]) => <option key={id} value={id}>{label}</option>)}</select></label><ActionMenu label="Действия с событием" compact items={[
      event.status === 'planned' && {id:'pending',icon:'clock',label:'Отложить перенос',description:'Убрать дату и выбрать новую позже',onSelect:()=>onStatus('pending')},
      event.seriesId && onStop && {id:'stop',icon:'repeat',label:'Завершить повторы',description:'История проведённых событий сохранится',onSelect:onStop},
      event.status !== 'cancelled' && {id:'cancel',icon:'close',label:'Отменить событие',danger:true,onSelect:()=>onStatus('cancelled'),separate:true},
      onDelete && {id:'delete',icon:'trash',label:'Удалить событие',danger:true,separate:true,onSelect:onDelete},
    ]}/></div><div class="lesson-detail-time"><Icon name="calendar"/><strong>{event.date ? dateLabel(event.date, { weekday: 'long', year: 'numeric' }) : 'Новое время ещё не выбрано'}</strong>{event.date && <span>{minutesToTime(event.start)}–{minutesToTime(event.start + event.duration)}</span>}</div>{event.status === 'planned' && eventHasEnded(event, now) && <p class="detail-time-note">Время прошло — отметь, состоялось ли событие.</p>}
    {event.seriesId && <span class="inspector-recurrence"><Icon name="repeat"/>Повторяется по расписанию</span>}
    {event.status === 'pending' && onReminder && <EventReminder key={event.id} data={data} event={event} now={now} onSave={onReminder} onRemove={onRemoveReminder} pushReady={pushReady} onEnablePush={onEnablePush}/>}
    <dl class="detail-fields">{type.fields.filter(field => fieldDisplay(field, event.fields?.[field.id]) !== '').map(field => <div key={field.id}><dt>{field.label}{field.archived ? ' · скрыто в форме' : ''}</dt><dd><LinkedValue field={field} value={event.fields[field.id]}/></dd></div>)}</dl>
    {recordLinks(record).length > 0 && <div class="detail-record-links"><h3 class="detail-section-title">Ссылки записи · {record?.name}</h3>{recordLinks(record).map(link => <ExternalLink key={link.href} href={link.href} className="card-link-chip">{link.label}</ExternalLink>)}</div>}
    {event.notes && <p class="notes-text"><LinkedText value={event.notes}/></p>}
    <EventPlacePreview location={event.location} expanded={mapExpanded} onExpand={setMapExpanded}/>
    {event.history?.length > 0 && <><h3 class="detail-section-title">История переносов</h3><ol class="move-history">{event.history.map((item, index) => <li key={index}><span>{dateLabel(item.fromDate)} · {minutesToTime(item.fromStart)}</span><Icon name="arrow"/><strong>{item.toDate ? `${dateLabel(item.toDate)} · ${minutesToTime(item.toStart)}` : 'Ожидает времени'}</strong></li>)}</ol></>}
    <div class="inspector-record">{student ? <Button onClick={() => onStudent(student)} icon="users">Открыть запись ученика</Button> : record && allRecords(data).some(item => item.id === record.id) && <Button onClick={() => onRecord(record)} icon="users">Открыть запись · {RECORD_KINDS[record.kind] || 'Запись'}</Button>}</div></div>
    <div class="inspector-footer"><Button onClick={onEdit} kind="primary" icon="settings">Редактировать</Button>{event.status !== 'done' && <Button onClick={onMove} icon="arrows">{event.status === 'pending' ? 'Выбрать дату' : 'Перенести'}</Button>}</div>
  </Modal>;
}
