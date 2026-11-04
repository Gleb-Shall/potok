import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import { Icon } from '../Icon.jsx';
import { addDays, minutesToTime } from '../../lib/domain.js';
import { projectWeek, restoreMove, saveMove } from '../../lib/events.js';
import { landingData } from './demo-data.js';
export { landingData } from './demo-data.js';

// FLIP runs only after a deliberate move; the rest of the page has no layout loop.
export function ProductDemo({ data: providedData, onChange, onMove } = {}) {
  const [localData, setLocalData] = useState(landingData);
  const data = providedData || localData;
  const setData = onChange || setLocalData;
  const [dragging, setDragging] = useState('');
  const [over, setOver] = useState('');
  const [message, setMessage] = useState('Переноси карточки между тремя днями. На телефоне используй стрелку в карточке.');
  const surface = useRef(null);
  const positions = useRef(new Map());
  const interaction = useRef(null);
  const start = useRef(data.events[0].anchorDate).current;
  const days = [start, addDays(start,1), addDays(start,2)];
  const projection = projectWeek(data,start,3);

  useLayoutEffect(() => {
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const moved = interaction.current;
    surface.current.querySelectorAll('[data-card-id]').forEach(node => {
      const before = positions.current.get(node.dataset.cardId);
      if (moved?.id === node.dataset.cardId) {
        if (moved.focus) node.querySelector('button')?.focus({preventScroll:true});
        const grid = surface.current.querySelector('.toy-grid');
        if (grid.scrollWidth > grid.clientWidth) node.scrollIntoView?.({block:'nearest',inline:'center',behavior:reduced?'auto':'smooth'});
      }
      if (reduced || !before || !node.animate) return;
      const after = node.getBoundingClientRect();
      node.animate([
        { transform:`translate(${before.left-after.left}px,${before.top-after.top}px) rotate(-2deg) scale(1.025)` },
        { transform:'translate(0,0) rotate(0) scale(1)' },
      ], { duration:540, easing:'cubic-bezier(.22,1,.36,1)' });
    });
    positions.current.clear();
    interaction.current = null;
  }, [data]);

  const update = (id, date) => {
    setDragging(''); setOver('');
    const event = data.events.find(item => item.id === id);
    if (!event || !days.includes(date) || event.date === date) return;
    interaction.current = {id,focus:document.activeElement?.closest?.('[data-card-id]')?.dataset.cardId === id};
    surface.current.querySelectorAll('[data-card-id]').forEach(node => positions.current.set(node.dataset.cardId,node.getBoundingClientRect()));
    try {
      const returning = date === event.anchorDate;
      setData(returning ? restoreMove(data,event) : saveMove(data,event,date,event.start));
      onMove?.(id);
      setMessage(returning ? 'Карточка вернулась. Перенос отменён.' : `${event.title} — ${['Понедельник','Вторник','Среда'][days.indexOf(date)]}.`);
    } catch (error) { positions.current.clear(); interaction.current=null; setMessage(error.message); }
  };

  return <div class="product-demo calendar-toy" id="try" ref={surface} data-ui>
    <div class="toy-grid">{days.map((date,index) => <section key={date} data-demo-day={date} data-card-count={projection.events.filter(event => event.date===date).length} class={`toy-day ${over===date?'toy-day-over':''}`} onDragOver={input => { if(dragging) { input.preventDefault(); input.dataTransfer.dropEffect='move'; setOver(date); } }} onDragLeave={input => { if(!input.currentTarget.contains(input.relatedTarget)) setOver(''); }} onDrop={input => { input.preventDefault(); update(dragging,date); }}>
      <header><span>{['Понедельник','Вторник','Среда'][index]}</span></header>
      <div class="toy-day-content">
        {projection.ghosts.filter(event => event.date===date).map(event => <button key={`ghost-${event.id}`} class="toy-origin ghost-card" onClick={() => update(event.id,date)}><Icon name="arrows"/><span><time>{minutesToTime(event.start)}</time><strong>{event.title}</strong></span><Icon name="repeat"/></button>)}
        {projection.events.filter(event => event.date===date).map(event => <article key={event.id} data-card-id={event.id} class={`toy-event event-card color-${event.color} ${dragging===event.id?'toy-dragging':''}`} draggable onDragStart={input => { input.dataTransfer.setData('application/x-potok-demo-card',event.id); input.dataTransfer.effectAllowed='move'; setDragging(event.id); }} onDragEnd={() => { setDragging(''); setOver(''); }}>
          <div><time>{minutesToTime(event.start)}–{minutesToTime(event.start+event.duration)}</time><span class="toy-grip" aria-hidden="true">⠿</span></div><h3>{event.title}</h3><footer><span>{event.typeId==='class'?'Учёба':event.typeId==='lesson'?'Занятие':'Для себя'}</span><button aria-label={`Перенести «${event.title}» на следующий день примера`} onClick={() => update(event.id,days[(index+1)%3])}><Icon name="arrow"/></button></footer>
        </article>)}
        <div class={`toy-drop ${over===date?'toy-drop-active':''}`} aria-hidden="true">{over===date&&<><Icon name="down"/><span>Отпусти здесь</span></>}</div>
      </div>
    </section>)}</div>
    <span class="sr-only" role="status">{message}</span>
  </div>;
}
