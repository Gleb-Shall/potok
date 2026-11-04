import { createPortal } from 'preact/compat';
import { useEffect, useState } from 'preact/hooks';
import { addDays, mondayOf, minutesToTime, todayISO } from '../lib/domain.js';

export function PressDragGhost({ controller, title }) {
  const { drag, ghostRef } = controller;
  if (!drag) return null;
  return createPortal(<div ref={ghostRef} class="press-drag-ghost" aria-hidden="true" style={{ background: drag.background, color: drag.color, transform: `translate3d(${drag.point.x}px,${drag.point.y}px,0)` }}><time>{minutesToTime(drag.item.start)}–{minutesToTime(drag.item.start + drag.item.duration)}</time><strong>{title}</strong></div>, document.body);
}

export function TouchMovePicker({ controller, title, onChoose }) {
  const { drag, hover, cancel } = controller;
  const [offset, setOffset] = useState(0);
  useEffect(() => { setOffset(0); }, [drag?.item.id]);
  useEffect(() => {
    if (!drag) return;
    const escape = event => { if (event.key === 'Escape') cancel(); };
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', escape);
    return () => { document.body.style.overflow = previous; document.removeEventListener('keydown', escape); };
  }, [Boolean(drag)]);
  useEffect(() => {
    if (!drag || !['page:prev', 'page:next'].includes(hover)) return;
    const timer = setTimeout(() => setOffset(value => value + (hover === 'page:prev' ? -14 : 14)), 650);
    return () => clearTimeout(timer);
  }, [Boolean(drag), hover, offset]);
  if (!drag) return null;
  const selected = hover && /^\d{4}-\d{2}-\d{2}$/.test(hover) ? hover : null;
  const start = addDays(mondayOf(drag.item.date || todayISO()), offset);
  const days = Array.from({ length: 14 }, (_, index) => addDays(start, index));
  return createPortal(<div class="touch-move-overlay"><section class="touch-move-picker" role="dialog" aria-modal="true" aria-label="Выбери день переноса"><header><div><small>ПЕРЕНОС СОБЫТИЯ</small><h2>На какой день?</h2></div><button type="button" onClick={cancel} aria-label="Отменить перенос">×</button></header><p>Удерживай карточку и отпусти над нужным днём.</p><div class="touch-move-month"><button type="button" data-press-page="page:prev" onClick={() => setOffset(value => value - 14)} aria-label="Предыдущие две недели">←</button><strong>{new Intl.DateTimeFormat('ru', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(start + 'T12:00:00Z'))}</strong><button type="button" data-press-page="page:next" onClick={() => setOffset(value => value + 14)} aria-label="Следующие две недели">→</button></div><div class="touch-move-days">{['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map(day => <small key={day}>{day}</small>)}{days.map(date => <button type="button" key={date} data-press-drop={date} aria-label={date} aria-current={date === todayISO() ? 'date' : undefined} class={`${date === drag.item.date ? 'is-source' : ''} ${hover === date ? 'is-target' : ''}`} onClick={() => { const item = drag.item; cancel(); onChoose(item, date); }}>{Number(date.slice(-2))}{date === drag.item.date && <span/>}</button>)}</div><footer aria-live="polite">{selected ? `${selected === drag.item.date ? 'Оставить на месте' : 'Перенести на'} ${new Intl.DateTimeFormat('ru', { day:'numeric', month:'long', timeZone:'UTC' }).format(new Date(selected + 'T12:00:00Z'))}` : title}</footer></section></div>, document.body);
}
