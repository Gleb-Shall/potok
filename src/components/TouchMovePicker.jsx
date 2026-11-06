import { calendarRange } from '../lib/events.js';
import { createPortal } from 'preact/compat';
import { useEffect, useRef, useState } from 'preact/hooks';
import { addDays, monthStart, minutesToTime, todayISO } from '../lib/domain.js';

export function PressDragGhost({ controller, title }) {
  const { drag, ghostRef } = controller;
  if (!drag) return null;
  return createPortal(<div ref={ghostRef} class="press-drag-ghost" aria-hidden="true" style={{ background: drag.background, color: drag.color, transform: `translate3d(${drag.point.x}px,${drag.point.y}px,0)` }}><time>{minutesToTime(drag.item.start)}–{minutesToTime(drag.item.start + drag.item.duration)}</time><strong>{title}</strong></div>, document.body);
}

export function TouchMovePicker({ controller, title, onChoose, dragging = true, onHover }) {
  const { drag, hover, cancel } = controller;
  const [offset, setOffset] = useState(0);
  const pickerRef = useRef(null);
  useEffect(() => { setOffset(0); }, [drag?.item.id]);
  useEffect(() => {
    if (!drag) return;
    const escape = event => { if (event.key === 'Escape') cancel(); };
    const previousFocus = document.activeElement;
    const frame = !dragging ? requestAnimationFrame(() => {
      const picker = pickerRef.current;
      const target = picker?.querySelector('.is-source') || picker?.querySelector('[aria-current=date]') || picker?.querySelector('[data-press-drop]');
      target?.focus({ preventScroll:true });
    }) : null;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', escape);
    return () => { cancelAnimationFrame(frame); document.body.style.overflow = previous; document.removeEventListener('keydown', escape); if (!dragging && previousFocus?.isConnected) previousFocus.focus({ preventScroll:true }); };
  }, [Boolean(drag), dragging]);
  useEffect(() => {
    if (!drag || !['page:prev', 'page:next'].includes(hover)) return;
    const timer = setTimeout(() => setOffset(value => value + (hover === 'page:prev' ? -1 : 1)), 650);
    return () => clearTimeout(timer);
  }, [Boolean(drag), hover, offset]);
  if (!drag) return null;
  const selected = hover && /^\d{4}-\d{2}-\d{2}$/.test(hover) ? hover : null;
  const month = monthStart(drag.item.date || todayISO(), offset);
  const { start, count } = calendarRange(month, 'month');
  const days = Array.from({ length: count }, (_, index) => addDays(start, index));
  return createPortal(<div class="touch-move-overlay" onClick={event => { if (event.target === event.currentTarget) cancel(); }}><section ref={pickerRef} class="touch-move-picker" onKeyDown={event => {
    if (event.key !== 'Tab') return;
    const buttons = [...pickerRef.current.querySelectorAll('button:not(:disabled)')];
    const first = buttons[0], last = buttons.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }} role="dialog" aria-modal="true" aria-label="Выбери день переноса" onDragOver={event => { if (dragging) event.preventDefault(); }}><header><div><h2>На какой день?</h2></div><button type="button" onClick={cancel} aria-label="Отменить перенос">×</button></header><p>{dragging ? 'Отпусти карточку над нужным днём.' : 'Выбери новую дату. Остальные повторы останутся на месте.'}</p><div class="touch-move-month"><button type="button" data-press-page="page:prev" onDragEnter={() => onHover?.('page:prev')} onClick={() => setOffset(value => value - 1)} aria-label="Предыдущий месяц">←</button><strong>{new Intl.DateTimeFormat('ru', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(month + 'T12:00:00Z'))}</strong><button type="button" data-press-page="page:next" onDragEnter={() => onHover?.('page:next')} onClick={() => setOffset(value => value + 1)} aria-label="Следующий месяц">→</button></div><div class="touch-move-days">{['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map(day => <small key={day}>{day}</small>)}{days.map(date => <button type="button" key={date} data-press-drop={date} onDragEnter={() => onHover?.(date)} onDragOver={event => { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; }} onDrop={event => { event.preventDefault(); event.stopPropagation(); const item = drag.item; cancel(); onChoose(item, date); }} aria-label={date} aria-current={date === todayISO() ? 'date' : undefined} class={`${date.slice(0,7) !== month.slice(0,7) ? 'is-outside-month' : ''} ${date === drag.item.date ? 'is-source' : ''} ${hover === date ? 'is-target' : ''}`} onClick={() => { const item = drag.item; cancel(); onChoose(item, date); }}>{Number(date.slice(-2))}{date === drag.item.date && <span/>}</button>)}</div><button type="button" class="touch-move-pending" data-press-action="pending" onDragEnter={() => onHover?.('pending')} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); event.stopPropagation(); const item = drag.item; cancel(); onChoose(item, 'pending'); }} onClick={() => { const item = drag.item; cancel(); onChoose(item, 'pending'); }}>Выбрать дату позже</button><footer aria-live="polite">{hover === 'pending' ? 'Ждёт нового времени' : selected ? `${selected === drag.item.date ? 'Оставить на месте' : 'Перенести на'} ${new Intl.DateTimeFormat('ru', { day:'numeric', month:'long', timeZone:'UTC' }).format(new Date(selected + 'T12:00:00Z'))}` : title}</footer></section></div>, document.body);
}
