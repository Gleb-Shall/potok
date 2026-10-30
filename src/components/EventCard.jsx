import { getType, getStudent, eventTitle, eventColor, fieldDisplay } from '../lib/events.js';
import { minutesToTime } from '../lib/domain.js';
import { dateLabel } from './UI.jsx';
import { Icon } from './Icon.jsx';

export function EventCard({ event, data, onOpen, onDragStart, onDragEnd, preview = false }) {
  const type = getType(data, event.typeId);
  const student = getStudent(data, event.studentId);
  const Tag = preview ? 'article' : 'button';
  if (event.ghost) return <button class="ghost-card" type="button" onClick={() => onOpen(event.id)}><span class="ghost-time">{minutesToTime(event.start)}</span><span>{eventTitle(data, event)}</span><small>{event.status === 'pending' ? 'Ждёт нового времени' : event.status === 'cancelled' ? 'Отменено' : `→ ${dateLabel(event.destinationDate)} · ${minutesToTime(event.destinationStart)}`}</small></button>;
  const meta = type.fields.filter(field => !field.archived && field.showOnCard && fieldDisplay(field, event.fields?.[field.id]) !== '').slice(0, 4);
  return <Tag type={preview ? undefined : 'button'} class={`lesson-card event-card color-${eventColor(data, event)} ${event.status === 'done' ? 'is-done' : ''}`} draggable={!preview && event.status !== 'done'} onClick={preview ? undefined : () => onOpen(event.id)} onDragStart={eventObject => {
    eventObject.dataTransfer.setData('text/plain', event.id); eventObject.dataTransfer.effectAllowed = 'move'; onDragStart?.(event.id);
  }} onDragEnd={onDragEnd} aria-label={`${eventTitle(data, event)}, ${dateLabel(event.date)}, ${minutesToTime(event.start)}`}>
    <span class="card-time">{minutesToTime(event.start)}–{minutesToTime(event.start + event.duration)}<span class="card-grip" aria-hidden="true">⠿</span></span>
    <span class="event-type-label">{type.icon} {type.name}</span><strong class="card-name">{eventTitle(data, event)}</strong>
    {student && <span class="card-subject">{student.name}{student.subject && ` · ${student.subject}`}</span>}
    {meta.length > 0 && <span class="card-fields">{meta.map(field => <span key={field.id}><small>{field.label}</small> {fieldDisplay(field, event.fields[field.id])}</span>)}</span>}
    <span class="card-bottom"><span><Icon name={event.status === 'done' ? 'check' : event.history?.length ? 'arrows' : event.seriesId ? 'repeat' : 'calendar'}/>{event.status === 'done' ? 'Проведено' : event.history?.length ? 'Перенос' : event.seriesId ? 'Повторяется' : 'Разовое'}</span><span>{event.duration} мин</span></span>
    {event.history?.length > 0 && <span class="transfer-origin">Было {dateLabel(event.originalDate)} · {minutesToTime(event.originalStart)}</span>}
    {event.busy === false && <span class="not-busy-label">Не блокирует время</span>}
  </Tag>;
}
