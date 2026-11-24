import { useState } from 'preact/hooks';
import { EventPlacePreview } from './EventPlacePreview.jsx';
import { ActionMenu } from './ActionMenu.jsx';
import { Modal, Button, dateLabel } from './UI.jsx';
import { eventTimeRange } from '../lib/timing.js';
import { minutesToTime } from '../lib/domain.js';
import { eventFields, eventType, allRecords, getStudent, getRecord, eventTitle, fieldDisplay, RECORD_KINDS } from '../lib/events.js';
import { LinkedValue, LinkedText, ExternalLink } from './LinkedValue.jsx';
import { recordLinks } from '../lib/links.js';
import { previousEventSlot } from '../lib/event-history.js';
import { eventAppearance, EVENT_STATES } from '../lib/state-appearance.js';
import { ActivityStatus } from './EventListRow.jsx';
import { Icon } from './Icon.jsx';

export function EventDetails({ data, event, onEdit, onMove, onRestore, onRemind, onStatus, onStudent, onRecord, onClose, onDelete, onStop, tasksSection, alertsSection, anchor, initialMapExpanded = false, readOnly = false, now = Date.now() }) {
  const [mapExpanded,setMapExpanded]=useState(Boolean(initialMapExpanded && event.location));
  const type = eventType(data, event);
  const values = eventFields(data,event);
  const student = getStudent(data, event.studentId);
  const record = getRecord(data, event);
  const appearance = eventAppearance(event, {now});
  const can = action => appearance.actions.includes(action);
  const elapsed = appearance.state === 'elapsed';
  const pending = appearance.state === 'pending';
  const previous = pending ? previousEventSlot(event) : null;
  const history = event.history?.length > 0 && <ol class="move-history">{event.history.map((item, index) => <li key={index}><span>{dateLabel(item.fromDate)} · {minutesToTime(item.fromStart)}</span><Icon name="arrow"/><strong>{item.toDate ? `${dateLabel(item.toDate)} · ${minutesToTime(item.toStart)}` : EVENT_STATES.pending.label}</strong></li>)}</ol>;
  return <Modal title={eventTitle(data, event)} eyebrow={type.name.toLocaleUpperCase('ru')} subtitle={record?.kind === 'student' && record.name !== eventTitle(data, event) ? `Ученик: ${record.name}` : undefined} onClose={onClose} className={`product-dialog event-inspector ${mapExpanded?'has-expanded-map':''}`} fullscreen={mapExpanded} anchor={mapExpanded ? null : anchor} onEscape={()=>mapExpanded?setMapExpanded(false):onClose()} panel>
    <div class="inspector-content"><div class="inspector-toolbar">{readOnly ? <span class="activity-status">В архиве</span> : <ActivityStatus appearance={appearance}/>} {!readOnly && <ActionMenu label="Действия с событием" compact items={[
      (elapsed || pending) && {id:'edit',icon:'settings',label:'Редактировать',onSelect:onEdit},
      elapsed && can('move') && {id:'move',icon:'arrows',label:'Перенести',onSelect:onMove},
      can('remind') && onRemind && {id:'remind',icon:'clock',label:'Напомнить',onSelect:onRemind},
      !elapsed && can('complete') && {id:'done',icon:'check',label:'Отметить проведённым',onSelect:()=>onStatus('done')},
      can('defer') && {id:'pending',icon:'clock',label:'Отложить перенос',description:'Убрать дату и выбрать новую позже',onSelect:()=>onStatus('pending')},
      can('reopen') && {id:'reopen',icon:'refresh',label:appearance.state==='confirmed'?'Снять отметку о проведении':'Восстановить событие',onSelect:()=>onStatus('planned')},
      event.seriesId && onStop && {id:'stop',icon:'repeat',label:'Завершить повторы',description:'История проведённых событий сохранится',onSelect:onStop},
      !elapsed && can('cancel') && {id:'cancel',icon:'close',label:'Отменить событие',danger:true,onSelect:()=>onStatus('cancelled'),separate:true},
      onDelete && {id:'delete',icon:'trash',label:'Удалить событие',danger:true,separate:elapsed || !can('cancel'),onSelect:onDelete},
    ]}/>}</div><div class="lesson-detail-time"><Icon name="calendar"/><strong>{event.date ? dateLabel(event.date, { weekday: 'long', year: 'numeric' }) : 'Новое время ещё не выбрано'}</strong>{event.date && <span>{eventTimeRange(event.start,event.duration)}</span>}</div>
    {event.archiveKind === 'series' && <p class="quiet-note">Серия с {dateLabel(event.from)}{event.until && ` по ${dateLabel(event.until)}`} · раз в {event.intervalWeeks || 1} нед.</p>}
    {event.seriesId && <span class="inspector-recurrence"><Icon name="repeat"/>Повторяется по расписанию</span>}
    {previous && <p class="pending-original-time">Было {dateLabel(previous.date)} · {eventTimeRange(previous.start,previous.duration)}</p>}
    <dl class="detail-fields">{type.fields.filter(field => fieldDisplay(field, values[field.id]) !== '').map(field => <div key={field.id}><dt>{field.label}{field.archived ? ' · скрыто в форме' : ''}</dt><dd><LinkedValue field={field} value={values[field.id]}/></dd></div>)}</dl>
    {recordLinks(record).length > 0 && <div class="detail-record-links"><h3 class="detail-section-title">Ссылки записи · {record?.name}</h3>{recordLinks(record).map(link => <ExternalLink key={link.href} href={link.href} className="card-link-chip">{link.label}</ExternalLink>)}</div>}
    {event.notes && <p class="notes-text"><LinkedText value={event.notes}/></p>}
    {!readOnly && <div class="inspector-record">{student ? <Button onClick={() => onStudent(student)} icon="users">Открыть запись ученика</Button> : record && allRecords(data).some(item => item.id === record.id) && <Button onClick={() => onRecord(record)} icon="users">Открыть запись · {RECORD_KINDS[record.kind] || 'Запись'}</Button>}</div>}
    {alertsSection}
    <EventPlacePreview location={event.location} expanded={mapExpanded} onExpand={setMapExpanded}/>
    {tasksSection}
    {history && <details class="inspector-history"><summary>История переносов</summary>{history}</details>}
    </div>
    {!readOnly && <div class="inspector-footer">
      {pending ? <><Button onClick={onMove} kind="primary" icon="calendar">Выбрать дату</Button>{can('restoreSlot') && onRestore && (event.originalDate || event.anchorDate) && <Button onClick={onRestore} icon="refresh">Вернуть на место</Button>}</> :
       elapsed ? <><Button kind="primary" icon="check" onClick={()=>onStatus('done')}>Проведён</Button><Button icon="close" onClick={()=>onStatus('cancelled')}>Отменён</Button></> :
       <><Button onClick={onEdit} kind="primary" icon="settings">Редактировать</Button>{can('move') && <Button onClick={onMove} icon="arrows">Перенести</Button>}</>}
    </div>}
  </Modal>;
}
