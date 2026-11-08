import { ActionMenu } from './ActionMenu.jsx';
import { ActivityTime } from './EventListRow.jsx';
import { previousEventSlot } from '../lib/event-history.js';
import { Button, dateLabel } from './UI.jsx';
import { Icon } from './Icon.jsx';
import { eventTitle } from '../lib/events.js';
import { minutesToTime } from '../lib/domain.js';

export function PendingEventCard({ event, data, onOpen, onRemind, onMove, onRestore, onDragStart, onDragEnd, journal = false }) {
  const source = event.originalDate || event.anchorDate;
  const previous = journal ? previousEventSlot(event) : null;
  const title = eventTitle(data,event);
  return <article class={`pending-card${journal ? ' activity-row' : ''}`} data-event-state="pending" data-event-id={event.id} draggable={Boolean(onDragStart)} onDragStart={input=>onDragStart?.(event,input)} onDragEnd={onDragEnd}>
    {journal ? <button type="button" class="activity-open card-open" onClick={()=>onOpen(event.id)}>
      <span class="activity-time">{previous ? <ActivityTime {...previous}/> : <small>Без даты</small>}</span>
      <span class="activity-identity"><strong>{title}</strong></span>
    </button> : <button type="button" class="pending-open card-open" onClick={()=>onOpen(event.id)}><strong>{title}</strong><small>{source ? `Было ${dateLabel(source)} · ${minutesToTime(event.originalStart ?? event.start)}` : 'Дата ещё не назначена'}</small></button>}
    <div class="pending-card-actions"><Button onClick={()=>onRemind(event)}>Напомнить</Button><Button onClick={()=>onMove(event)}>Выбрать дату</Button>{onRestore && source && <ActionMenu compact label={`Действия: ${eventTitle(data,event)}`} items={[{id:'restore',icon:'refresh',label:'Вернуть на место',onSelect:()=>onRestore(event)}]}/>}</div>
  </article>;
}

export function PendingQueue({ events, hidden, target, dropProps, renderEvent, onClose }) {
  return <section id="schedule-pending" hidden={hidden} data-board-drop="pending" class={`pending-panel ${events.length?'has-pending':'is-empty'} ${target==='pending'?'drop-target':''}`} {...dropProps}>
    <div class="pending-heading"><h2>Ждут новой даты <span class="section-count">{events.length}</span></h2><button type="button" class="pending-close icon-button" aria-label="Закрыть очередь переноса" onClick={onClose}><Icon name="close"/></button></div>
    {events.length ? <div class="pending-cards">{events.map(renderEvent)}</div> : <span class="all-good"><Icon name="check"/>Все события на своих местах</span>}
  </section>;
}
