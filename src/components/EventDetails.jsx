import { Modal, Button, dateLabel } from './UI.jsx';
import { minutesToTime } from '../lib/domain.js';
import { eventType, allRecords, getStudent, getRecord, eventTitle, fieldDisplay, RECORD_KINDS } from '../lib/events.js';
import { LinkedValue, LinkedText, ExternalLink } from './LinkedValue.jsx';
import { recordLinks } from '../lib/links.js';
import { eventHasEnded } from '../lib/event-history.js';
import { Icon } from './Icon.jsx';

export function EventDetails({ data, event, onEdit, onMove, onStatus, onStudent, onRecord, onClose, onDelete, onStop, now = Date.now() }) {
  const type = eventType(data, event);
  const student = getStudent(data, event.studentId);
  const record = getRecord(data, event);
  const labels = { planned: 'Запланировано', done: 'Проведено', pending: 'Ждёт нового времени', cancelled: 'Отменено' };
  return <Modal title={eventTitle(data, event)} eyebrow={`${type.icon} ${type.name.toLocaleUpperCase('ru')}`} subtitle={record?.kind === 'student' ? `Ученик: ${record.name}` : undefined} onClose={onClose}>
    <div class="lesson-detail-time"><Icon name="calendar"/><strong>{event.date ? dateLabel(event.date, { weekday: 'long', year: 'numeric' }) : 'Новое время ещё не выбрано'}</strong>{event.date && <span>{minutesToTime(event.start)}–{minutesToTime(event.start + event.duration)}</span>}</div><div class="detail-status">{labels[event.status]}{event.status === 'planned' && eventHasEnded(event, now) && ' · Время прошло, проведение не отмечено'}</div>
    {event.seriesId && <p class="quiet-note">Повторяющееся событие. В редакторе можно изменить один экземпляр или дальнейшее расписание.</p>}
    <dl class="detail-fields">{type.fields.filter(field => fieldDisplay(field, event.fields?.[field.id]) !== '').map(field => <div key={field.id}><dt>{field.label}{field.archived ? ' · скрыто в форме' : ''}</dt><dd><LinkedValue field={field} value={event.fields[field.id]}/></dd></div>)}</dl>
    {recordLinks(record).length > 0 && <div class="detail-record-links"><h3 class="detail-section-title">Ссылки записи · {record?.name}</h3>{recordLinks(record).map(link => <ExternalLink key={link.href} href={link.href} className="card-link-chip">{link.label}</ExternalLink>)}</div>}
    {event.notes && <p class="notes-text"><LinkedText value={event.notes}/></p>}
    {event.location && <a class="location-trigger" href={`https://www.openstreetmap.org/?mlat=${event.location.lat}&mlon=${event.location.lng}#map=17/${event.location.lat}/${event.location.lng}`} target="_blank" rel="noopener noreferrer"><span class="place-result-pin"><Icon name="pin"/></span><span><strong>{event.location.label}</strong><small>{event.location.address || 'Открыть место на карте'}</small></span><Icon name="right"/></a>}
    {event.history?.length > 0 && <><h3 class="detail-section-title">История переносов</h3><ol class="move-history">{event.history.map((item, index) => <li key={index}><span>{dateLabel(item.fromDate)} · {minutesToTime(item.fromStart)}</span><Icon name="arrow"/><strong>{item.toDate ? `${dateLabel(item.toDate)} · ${minutesToTime(item.toStart)}` : 'Ожидает времени'}</strong></li>)}</ol></>}
    <div class="lesson-actions">{student ? <Button onClick={() => onStudent(student)} icon="users">Ученик</Button> : record && allRecords(data).some(item => item.id === record.id) && <Button onClick={() => onRecord(record)} icon="users">{RECORD_KINDS[record.kind] || 'Запись'}</Button>}{event.status !== 'done' && <Button onClick={onMove} icon="arrows">Перенести</Button>}<Button onClick={onEdit} kind="primary" icon="settings">Редактировать</Button></div>
    <div class="lesson-secondary-actions">{event.seriesId && onStop && <button type="button" class="text-button" onClick={onStop}>Завершить повторы с сохранением истории</button>}{onDelete && <button type="button" class="text-button danger-text delete-action" onClick={onDelete}><Icon name="trash"/>Удалить событие</button>}{event.status === 'planned' && <><button class="text-button" onClick={() => onStatus('done')}>Отметить проведённым</button><button class="text-button" onClick={() => onStatus('pending')}>Ждёт нового времени</button></>}{['done', 'cancelled'].includes(event.status) && <button class="text-button" onClick={() => onStatus('planned')}>Восстановить событие</button>}{event.status !== 'cancelled' && <button class="text-button danger-text" onClick={() => onStatus('cancelled')}>Отменить событие</button>}</div>
  </Modal>;
}
