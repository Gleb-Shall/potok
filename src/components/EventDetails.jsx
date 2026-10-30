import { Modal, Button, dateLabel } from './UI.jsx';
import { minutesToTime } from '../lib/domain.js';
import { getType, getStudent, eventTitle, fieldDisplay } from '../lib/events.js';
import { Icon } from './Icon.jsx';

export function EventDetails({ data, event, onEdit, onStatus, onStudent, onClose }) {
  const type = getType(data, event.typeId);
  const student = getStudent(data, event.studentId);
  const labels = { planned: 'Запланировано', done: 'Проведено', pending: 'Ждёт нового времени', cancelled: 'Отменено' };
  return <Modal title={eventTitle(data, event)} eyebrow={`${type.icon} ${type.name.toLocaleUpperCase('ru')}`} subtitle={student ? `Ученик: ${student.name}` : undefined} onClose={onClose}>
    <div class="lesson-detail-time"><Icon name="calendar"/><strong>{event.date ? dateLabel(event.date, { weekday: 'long', year: 'numeric' }) : 'Новое время ещё не выбрано'}</strong>{event.date && <span>{minutesToTime(event.start)}–{minutesToTime(event.start + event.duration)}</span>}</div><div class="detail-status">{labels[event.status]}</div>
    {event.seriesId && <p class="quiet-note">Повторяющееся событие. В редакторе можно изменить один экземпляр или дальнейшее расписание.</p>}
    <dl class="detail-fields">{type.fields.filter(field => fieldDisplay(field, event.fields?.[field.id]) !== '').map(field => <div key={field.id}><dt>{field.label}{field.archived ? ' · скрыто в форме' : ''}</dt><dd>{fieldDisplay(field, event.fields[field.id])}</dd></div>)}</dl>
    {event.notes && <p class="notes-text">{event.notes}</p>}
    {event.history?.length > 0 && <><h3 class="detail-section-title">История переносов</h3><ol class="move-history">{event.history.map((item, index) => <li key={index}><span>{dateLabel(item.fromDate)} · {minutesToTime(item.fromStart)}</span><Icon name="arrow"/><strong>{item.toDate ? `${dateLabel(item.toDate)} · ${minutesToTime(item.toStart)}` : 'Ожидает времени'}</strong></li>)}</ol></>}
    <div class="lesson-actions">{student && <Button onClick={() => onStudent(student)} icon="users">Ученик</Button>}<Button onClick={onEdit} kind="primary" icon="settings">Редактировать</Button></div>
    <div class="lesson-secondary-actions">{event.status === 'planned' && <><button class="text-button" onClick={() => onStatus('done')}>Отметить проведённым</button><button class="text-button" onClick={() => onStatus('pending')}>Ждёт нового времени</button></>}{['done', 'cancelled'].includes(event.status) && <button class="text-button" onClick={() => onStatus('planned')}>Восстановить событие</button>}{event.status !== 'cancelled' && <button class="text-button danger-text" onClick={() => onStatus('cancelled')}>Отменить событие</button>}</div>
  </Modal>;
}
