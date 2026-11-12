import { useEffect, useRef } from 'preact/hooks';

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
  const frame = useRef(0);
  const clear = () => {
    const active = gesture.current;
    gesture.current = null;
    cancelAnimationFrame(frame.current);
    frame.current = 0;
    if (!active?.moved) return;
    active.list.removeAttribute('data-field-reordering');
    active.rows[active.from].node.removeAttribute('data-dragging');
    for (const {node} of active.rows) node.style.removeProperty('--field-reorder-y');
  };
  useEffect(() => clear, []);

  const paint = (active, y) => {
    const bounds = active.list.getBoundingClientRect();
    const localY = y - bounds.top;
    const {from, rows} = active;
    rows[from].node.style.setProperty('--field-reorder-y', `${localY - active.startY}px`);
    let to = from;
    if (localY < active.startY) {
      while (to > 0 && localY < rows[to - 1].center) to--;
    } else {
      while (to < rows.length - 1 && localY > rows[to + 1].center) to++;
    }
    if (active.to !== to) {
      active.to = to;
      rows.forEach(({node}, index) => {
        if (index === from) return;
        const shift = index > from && index <= to ? -active.step : index < from && index >= to ? active.step : 0;
        node.style.setProperty('--field-reorder-y', `${shift}px`);
      });
    }
    return y >= bounds.top - 24 && y <= bounds.bottom + 24 ? to : null;
  };
  const autoScroll = () => {
    frame.current = 0;
    const active = gesture.current;
    if (!active?.scroll) return;
    const {scroll, y} = active;
    const root = scroll === document.scrollingElement;
    const bounds = root ? { top:0, bottom:window.innerHeight } : scroll.getBoundingClientRect();
    const top = Math.max(0, bounds.top), bottom = Math.min(window.innerHeight, bounds.bottom);
    const speed = y < top + 44 ? -Math.min(14, (top + 44 - y) / 4)
      : y > bottom - 44 ? Math.min(14, (y - bottom + 44) / 4) : 0;
    if (!speed) return;
    const before = scroll.scrollTop;
    scroll.scrollTop += speed;
    if (scroll.scrollTop === before) return;
    paint(active, y);
    frame.current = requestAnimationFrame(autoScroll);
  };
  const move = event => {
    const active = gesture.current;
    if (active?.pointerId !== event.pointerId) return;
    if (!active.moved) {
      if (Math.abs(event.clientY - active.pointerY) < 5) return;
      active.moved = true;
      active.list.setAttribute('data-field-reordering', '');
      active.rows[active.from].node.setAttribute('data-dragging', '');
    }
    active.y = event.clientY;
    paint(active, active.y);
    if (!frame.current) frame.current = requestAnimationFrame(autoScroll);
  };
  const finish = event => {
    const active = gesture.current;
    if (active?.pointerId !== event.pointerId) return;
    const to = event.type === 'pointerup' && active.moved ? paint(active, event.clientY) : null;
    clear();
    if (to !== null && to !== active.from) onMove(active.from, to);
  };
  return {
    list,
    gripProps: (index, label) => ({
      'aria-label': `Переместить «${label}», позиция ${index + 1} из ${count}`,
      title: 'Перетащить поле или использовать ↑ и ↓',
      disabled: count < 2,
      onPointerDown: event => {
        if (!event.isPrimary || event.button !== 0 || gesture.current || count < 2) return;
        const node = list.current;
        const {top} = node.getBoundingClientRect();
        const rows = Array.from(node.children, row => {
          const bounds = row.getBoundingClientRect();
          return {node:row, top:bounds.top - top, height:bounds.height, center:bounds.top - top + bounds.height / 2};
        });
        const gap = Math.max(0, rows[1].top - rows[0].top - rows[0].height);
        let scroll = node.parentElement;
        while (scroll && !(scroll.scrollHeight > scroll.clientHeight && /auto|scroll/.test(getComputedStyle(scroll).overflowY))) scroll = scroll.parentElement;
        event.currentTarget.setPointerCapture?.(event.pointerId);
        gesture.current = {list:node, rows, scroll:scroll || document.scrollingElement,
          pointerId:event.pointerId, from:index, to:index, pointerY:event.clientY,
          startY:event.clientY - top, step:rows[index].height + gap};
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
