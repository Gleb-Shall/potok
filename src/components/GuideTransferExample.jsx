import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import { moveEvent, restoreMove } from '../lib/events.js';
import { ActivityTime } from './EventListRow.jsx';

const days = [
  {date:'2026-11-10',label:'Вторник, 10 ноября',time:'15:00–16:00',start:900},
  {date:'2026-11-11',label:'Среда, 11 ноября',time:'16:00–17:00',start:960},
];

export function GuideTransferExample({lesson,workspace}) {
  const [event,setEvent] = useState(lesson);
  const [selected,setSelected] = useState(false);
  const [target,setTarget] = useState(null);
  const board = useRef(null);
  const card = useRef(null);
  const gesture = useRef(null);
  const skipClick = useRef(false);

  const transfer = day => {
    const next = day.date===lesson.date
      ? restoreMove({...workspace,events:[event]},event).events[0]
      : moveEvent(event,day.date,day.start,event.duration);
    setEvent(next);
    setSelected(false);
  };

  useLayoutEffect(()=>{
    if (event!==lesson) card.current?.focus({preventScroll:true});
  },[event,lesson]);

  const slotAt = ({clientX,clientY}) => {
    const slots = board.current.querySelectorAll('[data-transfer-date]');
    for (const slot of slots) {
      if (slot.dataset.transferDate===event.date) continue;
      const {left,top,right,bottom} = slot.getBoundingClientRect();
      if (clientX>=left && clientX<right && clientY>=top && clientY<bottom) return slot.dataset.transferDate;
    }
    return null;
  };
  const start = pointer => {
    if (!pointer.isPrimary || pointer.button!==0 || gesture.current) return;
    skipClick.current = false;
    pointer.currentTarget.setPointerCapture(pointer.pointerId);
    gesture.current = {id:pointer.pointerId,x:pointer.clientX,y:pointer.clientY,moved:false};
  };
  const move = pointer => {
    const drag = gesture.current;
    if (!drag || drag.id!==pointer.pointerId) return;
    const x = pointer.clientX-drag.x, y = pointer.clientY-drag.y;
    if (!drag.moved && Math.hypot(x,y)<6) return;
    drag.moved = true;
    pointer.currentTarget.dataset.dragging = '';
    pointer.currentTarget.style.transform = `translate3d(${x}px,${y}px,0)`;
    setTarget(slotAt(pointer));
  };
  const clearGesture = () => {
    if (!gesture.current) return;
    const {id,moved} = gesture.current;
    gesture.current = null;
    if (moved) skipClick.current = true;
    const node = card.current;
    node?.removeAttribute('data-dragging');
    node?.style.removeProperty('transform');
    if (node?.hasPointerCapture(id)) node.releasePointerCapture(id);
    setTarget(null);
  };
  const finish = pointer => {
    const drag = gesture.current;
    if (!drag || drag.id!==pointer.pointerId) return;
    const date = pointer.type==='pointerup' && drag.moved ? slotAt(pointer) : null;
    clearGesture();
    if (date) transfer(days.find(day=>day.date===date));
  };

  return <>
    <p>Перетащи занятие на соседний день. Можно также выбрать карточку и нажать на свободное время.</p>
    <div ref={board} class="guide-example-slots guide-transfer-demo" onKeyDown={key=>{
      if (key.key==='Escape' && (gesture.current || selected)) {
        key.stopPropagation();
        clearGesture();
        setSelected(false);
      }
    }}>
      {days.map(day=><div key={day.date} data-transfer-date={day.date} data-drop-target={target===day.date ? '' : undefined}>
        <small>{day.label}</small>
        {event.date===day.date ?
          <button ref={card} type="button" class="guide-event-sample guide-drag-card" aria-pressed={selected}
            onPointerDown={start} onPointerMove={move} onPointerUp={finish} onPointerCancel={finish} onLostPointerCapture={finish}
            onContextMenu={menu=>menu.preventDefault()}
            onClick={click=>{if (!skipClick.current || click.detail===0) setSelected(value=>!value);skipClick.current=false;}}>
            <strong>{event.title}</strong><span><ActivityTime start={event.start} duration={event.duration}/></span>
          </button> :
          <button type="button" class="guide-slot-empty guide-drop-slot" disabled={!selected} onClick={()=>transfer(day)}>
            {day.time}<small>{day.date===lesson.date ? 'Исходное время' : 'Свободно'}</small>
          </button>}
      </div>)}
      <div><small>Следующая встреча</small><strong>{event.title}</strong><span>Вт, 17 ноября · 15:00–16:00</span></div>
    </div>
    <p class="guide-demo-status" role="status">{selected ? 'Теперь выбери свободное время.' :
      event!==lesson && (event.date===lesson.date ? 'Занятие вернулось на вторник.' : 'Занятие перенесено на среду. Следующая встреча осталась во вторник.')}</p>
  </>;
}
