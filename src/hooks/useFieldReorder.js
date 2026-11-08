import { useRef, useState } from 'preact/hooks';

export function moveField(items, from, to) {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) return items;
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export function useFieldReorder(count, onMove) {
  const list = useRef(null);
  const gesture = useRef(null);
  const [drop, setDrop] = useState(null);
  const targetAt = y => {
    const bounds = list.current.getBoundingClientRect();
    if (y < bounds.top - 24 || y > bounds.bottom + 24) return null;
    const target = Array.from(list.current.children).findIndex(row => y < row.getBoundingClientRect().bottom);
    return target < 0 ? count - 1 : target;
  };
  const move = event => {
    const active = gesture.current;
    if (active?.pointerId !== event.pointerId) return;
    if (!active.moved && Math.abs(event.clientY - active.startY) < 5) return;
    active.moved = true;
    const to = targetAt(event.clientY);
    setDrop(previous => to === null ? null : previous?.to === to ? previous : {from:active.from,to});
  };
  const finish = event => {
    const active = gesture.current;
    if (active?.pointerId !== event.pointerId) return;
    gesture.current = null;
    setDrop(null);
    if (event.type !== 'pointerup' || !active.moved) return;
    const to = targetAt(event.clientY);
    if (to !== null && to !== active.from) onMove(active.from, to);
  };
  return {
    list,
    rowProps: index => ({
      'data-drop': drop?.to === index && drop.from !== index ? (drop.from < index ? 'after' : 'before') : undefined,
      'data-dragging': drop?.from === index ? '' : undefined,
    }),
    gripProps: (index, label) => ({
      'aria-label': `Переместить «${label}», позиция ${index + 1} из ${count}`,
      title: 'Перетащить поле или использовать ↑ и ↓',
      disabled: count < 2,
      onPointerDown: event => {
        if (!event.isPrimary || event.button !== 0 || gesture.current) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        gesture.current = {pointerId:event.pointerId,from:index,startY:event.clientY};
      },
      onPointerMove: move,
      onPointerUp: finish,
      onPointerCancel: finish,
      onLostPointerCapture: finish,
      onKeyDown: event => {
        const direction = {ArrowUp:-1,ArrowDown:1}[event.key];
        if (!direction) return;
        event.preventDefault();
        const to = index + direction;
        if (to < 0 || to >= count) return;
        onMove(index, to);
        // WebKit can blur the handle when its row changes position.
        const handle = event.currentTarget;
        requestAnimationFrame(() => { if (handle.isConnected) handle.focus({preventScroll:true}); });
      },
    }),
  };
}
