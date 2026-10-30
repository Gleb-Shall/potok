import { getType, getRecord, eventTitle, eventColor, fieldDisplay } from '../lib/events.js';
import { minutesToTime } from '../lib/domain.js';
import { dateLabel } from './UI.jsx';
import { Icon } from './Icon.jsx';

export function EventCard({ event, data, onOpen, onDragStart, onDragEnd, preview = false, onDelete, expanded = preview, onToggle }) {
  const type = getType(data, event.typeId);
  const record = getRecord(data, event);
  if (event.ghost) return <button class="ghost-card" type="button" onClick={() => onOpen(event.id)}><span class="ghost-time">{minutesToTime(event.start)}</span><span>{eventTitle(data, event)}</span><small>{event.status === 'pending' ? 'Ждёт нового времени' : event.status === 'cancelled' ? 'Отменено' : `→ ${dateLabel(event.destinationDate)} · ${minutesToTime(event.destinationStart)}`}</small></button>;
  const meta = type.fields.filter(field => !field.archived && field.showOnCard && fieldDisplay(field, event.fields?.[field.id]) !== '');
  const summary = <><span class="card-time">{minutesToTime(event.start)}–{minutesToTime(event.start + event.duration)}<span class="card-grip" aria-hidden="true">⠿</span></span><strong class="card-name">{eventTitle(data, event)}</strong><span class="event-type-label">{type.icon} {type.name}{event.status === 'done' ? ' · ✓' : event.history?.length ? ' · ↔' : event.seriesId ? ' · ↻' : ''}</span></>;
  return <article class={`lesson-card event-card color-${eventColor(data, event)} ${expanded ? 'is-expanded' : 'is-compact'} ${event.status === 'done' ? 'is-done' : ''}`} draggable={!preview && event.status !== 'done'} onDragStart={eventObject => {
    eventObject.dataTransfer.setData('text/plain', event.id); eventObject.dataTransfer.effectAllowed = 'move'; onDragStart?.(event.id);
  }} onDragEnd={onDragEnd}>
    {preview ? <div class="card-open">{summary}</div> : <button type="button" class="card-open" onClick={() => onOpen(event.id)} aria-label={`${eventTitle(data, event)}, ${dateLabel(event.date)}, ${minutesToTime(event.start)}`}>{summary}</button>}
    {expanded && <div class="card-expanded-content">
      {record && record.name !== eventTitle(data, event) && <span class="card-subject">{record.name}{(record.subject || record.subtitle) && ` · ${record.subject || record.subtitle}`}</span>}
      {meta.length > 0 && <dl class="card-fields">{meta.map(field => <div key={field.id}><dt>{field.label}</dt><dd>{fieldDisplay(field, event.fields[field.id])}</dd></div>)}</dl>}
      {event.location && <span class="card-place"><Icon name="pin"/>{event.location.label}</span>}
      {event.notes && <p class="card-note">{event.notes}</p>}
      <span class="card-bottom"><span><Icon name={event.status === 'done' ? 'check' : event.history?.length ? 'arrows' : event.seriesId ? 'repeat' : 'calendar'}/>{event.status === 'done' ? 'Проведено' : event.history?.length ? 'Перенос' : event.seriesId ? 'Повторяется' : 'Разовое'}</span><span>{event.duration} мин</span></span>
      {event.history?.length > 0 && <span class="transfer-origin">Было {dateLabel(event.originalDate)} · {minutesToTime(event.originalStart)}</span>}
      {event.busy === false && <span class="not-busy-label">Не блокирует время</span>}
    </div>}
    {!preview && <div class="card-controls"><button type="button" class="card-expand" aria-expanded={expanded} onClick={() => onToggle?.(event.id)}>{expanded ? 'Свернуть ↑' : 'Подробнее ↓'}</button>{onDelete && <button type="button" class="card-delete" aria-label={`Удалить событие «${eventTitle(data, event)}»`} onClick={() => onDelete(event)}><Icon name="trash"/></button>}</div>}
  </article>;
}
