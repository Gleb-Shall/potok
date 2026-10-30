import { eventType, getRecord, eventTitle, eventColor, fieldDisplay } from '../lib/events.js';
import { minutesToTime } from '../lib/domain.js';
import { LinkedValue, ExternalLink, LinkedText } from './LinkedValue.jsx';
import { linkHref, recordLinks } from '../lib/links.js';
import { eventAppearance } from '../lib/state-appearance.js';
import { dateLabel } from './UI.jsx';
import { MarkerPaint } from './MarkerPaint.jsx';
import { Icon } from './Icon.jsx';

export function EventCard({ event, data, onOpen, onDragStart, onDragEnd, preview = false, onDelete, expanded = preview, onToggle, now = Date.now(), stateEffects }) {
  const type = eventType(data, event);
  const appearance = eventAppearance(event, { now, preview, effects: stateEffects });
  const record = getRecord(data, event);
  if (event.ghost) return <button class="ghost-card" type="button" onClick={() => onOpen(event.id)}><span class="ghost-time">{minutesToTime(event.start)}</span><span>{eventTitle(data, event)}</span><small>{event.status === 'pending' ? 'Ждёт нового времени' : event.status === 'cancelled' ? 'Отменено' : `→ ${dateLabel(event.destinationDate)} · ${minutesToTime(event.destinationStart)}`}</small></button>;
  const available = type.fields.filter(field => !field.archived && fieldDisplay(field, event.fields?.[field.id]) !== '');
  const meta = available.filter(field => field.showOnCard !== false);
  const compact = available.filter(field => field.showCompact ?? (field.type === 'url' && field.showOnCard !== false));
  const eventLinkHrefs = new Set((expanded ? meta : compact).flatMap(field => field.type === 'url' && linkHref(event.fields?.[field.id]) ? [linkHref(event.fields[field.id])] : []));
  const eventLinkLabels = new Set((expanded ? meta : compact).filter(field => field.type === 'url' && linkHref(event.fields?.[field.id])).map(field => field.label.trim().toLocaleLowerCase('ru')));
  const inheritedLinks = recordLinks(record).filter(link => !eventLinkHrefs.has(link.href) && !eventLinkLabels.has(link.label.trim().toLocaleLowerCase('ru')));
  const summary = <><span class="card-time">{minutesToTime(event.start)}–{minutesToTime(event.start + event.duration)}<span class="card-time-icons">{appearance.icon && <span class="event-state-mark" role="img" aria-label={appearance.label} title={appearance.label}><Icon name={appearance.icon}/></span>}<span class="card-grip" aria-hidden="true">⠿</span></span></span><strong class="card-name">{eventTitle(data, event)}</strong><span class="event-type-label">{type.icon} {type.name}{event.history?.length ? ' · ↔' : event.seriesId ? ' · ↻' : ''}</span></>;
  return <article class={`lesson-card event-card color-${eventColor(data, event)} ${expanded ? 'is-expanded' : 'is-compact'} ${appearance.state === 'confirmed' ? 'is-done' : appearance.state === 'elapsed' ? 'is-past' : ''}`} data-event-state={appearance.state} data-state-effect={appearance.effect} draggable={!preview && event.status !== 'done' && Boolean(onDragStart)} onDragStart={eventObject => {
    if (eventObject.target.closest?.('a')) { eventObject.preventDefault(); return; }
    eventObject.dataTransfer.setData('text/plain', event.id); eventObject.dataTransfer.effectAllowed = 'move'; onDragStart?.(event.id);
  }} onDragEnd={onDragEnd}>
    {appearance.effect === 'marker' && ['elapsed', 'confirmed'].includes(appearance.state) && <MarkerPaint key={appearance.state}/>}
    {preview ? <div class="card-open">{summary}</div> : <button type="button" class="card-open" onClick={() => onOpen(event.id)} aria-label={`${eventTitle(data, event)}, ${dateLabel(event.date)}, ${minutesToTime(event.start)}${appearance.icon ? `, ${appearance.label}` : ''}`}>{summary}</button>}
    {!expanded && compact.length > 0 && <dl class="card-fields compact-fields">{compact.map(field => <div key={field.id}><dt>{field.label}</dt><dd><LinkedValue field={field} value={event.fields[field.id]}/></dd></div>)}</dl>}
    {inheritedLinks.length > 0 && <div class="card-record-links" aria-label="Ссылки связанной записи">{inheritedLinks.map(link => <ExternalLink key={link.href} href={link.href} className="card-link-chip">{link.label}</ExternalLink>)}</div>}
    {expanded && <div class="card-expanded-content">
      {record && record.name !== eventTitle(data, event) && <span class="card-subject">{record.name}{(record.subject || record.subtitle) && ` · ${record.subject || record.subtitle}`}</span>}
      {meta.length > 0 && <dl class="card-fields">{meta.map(field => <div key={field.id}><dt>{field.label}</dt><dd><LinkedValue field={field} value={event.fields[field.id]}/></dd></div>)}</dl>}
      {event.location && <span class="card-place"><Icon name="pin"/>{event.location.label}</span>}
      {event.notes && <p class="card-note"><LinkedText value={event.notes}/></p>}
      <span class="card-bottom"><span><Icon name={event.status === 'done' ? 'check' : event.history?.length ? 'arrows' : event.seriesId ? 'repeat' : 'calendar'}/>{event.status === 'done' ? 'Проведено' : event.history?.length ? 'Перенос' : event.seriesId ? 'Повторяется' : 'Разовое'}</span><span>{event.duration} мин</span></span>
      {event.history?.length > 0 && <span class="transfer-origin">Было {dateLabel(event.originalDate)} · {minutesToTime(event.originalStart)}</span>}
      {event.busy === false && <span class="not-busy-label">Не блокирует время</span>}
    </div>}
    {!preview && (onToggle || onDelete) && <div class="card-controls">{onToggle && <button type="button" class="card-expand" aria-expanded={expanded} onClick={() => onToggle?.(event.id)}>{expanded ? 'Свернуть ↑' : 'Подробнее ↓'}</button>}{onDelete && <button type="button" class="card-delete" aria-label={`Удалить событие «${eventTitle(data, event)}»`} onClick={() => onDelete(event)}><Icon name="trash"/></button>}</div>}
  </article>;
}
