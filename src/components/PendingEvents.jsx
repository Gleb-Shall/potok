import { useEffect, useRef, useState } from 'preact/hooks';
import { ActionMenu } from './ActionMenu.jsx';
import { ActivityTime } from './EventListRow.jsx';
import { HistoryRow } from './HistoryView.jsx';
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

export function EventQueueButton({ transfers, confirmations, expanded, onClick }) {
  const total = transfers + confirmations;
  if (!total && !expanded) return null;
  const label = confirmations ? transfers ? 'Ожидающие события' : 'Подтверждения' : 'Ждут новой даты';
  return <Button id="schedule-pending-trigger" kind="secondary event-queue-trigger" icon={confirmations && !transfers ? 'check' : 'inbox'}
    aria-label={label} aria-controls="schedule-pending" aria-expanded={expanded} onClick={onClick}>
    <span>{label}</span><span class="section-count" aria-hidden="true">{total}</span>
  </Button>;
}

export function EventQueue({ data, now, pending, confirmations, renderPending, onOpen, onStatus, initialView = 'transfers', forceTransfers = false }) {
  const [view, setView] = useState(initialView);
  const showingTransfers = forceTransfers || view === 'transfers';
  return <div class="event-queue">
    <div class="section-switch event-queue-switch" role="group" aria-label="Ожидающие события">
      <button type="button" aria-pressed={showingTransfers} onClick={()=>setView('transfers')}>Переносы <span>{pending.length}</span></button>
      <button type="button" aria-pressed={!showingTransfers} disabled={forceTransfers} onClick={()=>setView('confirmations')}>Подтверждения <span>{confirmations.length}</span></button>
    </div>
    {showingTransfers ? (pending.length ? <div class="pending-cards">{pending.map(renderPending)}</div> :
      <p class="activity-empty">Все события на своих местах</p>) :
      (confirmations.length ? <div class="activity-list event-confirmations">
        {confirmations.map(event=><HistoryRow key={event.id} {...{data,event,now,onOpen,onStatus}} showDate allowCancellation/>)}
      </div> : <p class="activity-empty">Все прошедшие события отмечены.</p>)}
  </div>;
}

export function PendingQueue({ open, dragging, target, dropProps, onClose, ...queue }) {
  const heading = useRef(null);
  useEffect(() => { if (open) heading.current?.focus(); }, [open]);
  return <section id="schedule-pending" aria-labelledby="schedule-pending-title" hidden={!open && !dragging}
    data-board-drop={dragging ? 'pending' : undefined} class={`pending-panel${target==='pending'?' drop-target':''}`} {...dropProps}
    onKeyDown={event=>{ if (open && event.key==='Escape') { event.stopPropagation(); onClose(); } }}>
    <div class="pending-heading">
      <h2 ref={heading} id="schedule-pending-title" tabIndex={-1}>Ожидающие события</h2>
      {open && <Button kind="secondary pending-close" icon="close" aria-label="Закрыть ожидающие события" onClick={onClose}/>}
    </div>
    {(open || dragging) && <EventQueue {...queue} forceTransfers={dragging} initialView={queue.confirmations.length ? 'confirmations' : 'transfers'}/>}
  </section>;
}
