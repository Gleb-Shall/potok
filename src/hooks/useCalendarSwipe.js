import { useEffect, useRef } from 'preact/hooks';

// Horizontal intent changes dates. Vertical scrolling and card gestures stay native.
export function useCalendarSwipe(root, onShift, enabled, view) {
  const latest = useRef(onShift);
  latest.current = onShift;
  useEffect(() => {
    const node = root.current;
    if (!enabled || !node) return;
    let wheelTotal = 0, wheelLocked = false, wheelTimer;
    let touch = null, suppressClickUntil = 0;
    const calendarTarget = target => target instanceof Element &&
      target.closest('.week-scroller, .calendar-scroll, .mobile-days') &&
      !target.closest('input, select, textarea, a, [contenteditable], .calendar-options');
    const wheel = event => {
      if (!calendarTarget(event.target) || event.ctrlKey) return;
      const dx = event.shiftKey && !event.deltaX ? event.deltaY : event.deltaX;
      if (!dx || (!event.shiftKey && Math.abs(dx) <= Math.abs(event.deltaY))) return;
      event.preventDefault();
      clearTimeout(wheelTimer);
      wheelTimer = setTimeout(() => { wheelTotal = 0; wheelLocked = false; }, 180);
      if (wheelLocked) return;
      wheelTotal += dx * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? node.clientWidth : 1);
      if (Math.abs(wheelTotal) < 60) return;
      wheelLocked = true;
      latest.current(Math.sign(wheelTotal));
    };
    const start = event => {
      touch = null;
      if (event.touches.length !== 1 || !calendarTarget(event.target) ||
          event.target.closest('[data-event-id], .week-event, button')) return;
      const point = event.touches[0];
      touch = { id: point.identifier, x: point.clientX, y: point.clientY, axis: null, dx: 0 };
    };
    const move = event => {
      if (!touch) return;
      if (event.touches.length !== 1) { touch = null; return; }
      const point = event.touches[0];
      if (point.identifier !== touch.id) { touch = null; return; }
      const dx = point.clientX - touch.x, dy = point.clientY - touch.y;
      if (!touch.axis && Math.max(Math.abs(dx), Math.abs(dy)) > 10)
        touch.axis = Math.abs(dx) > Math.abs(dy) * 1.3 ? 'x' : 'y';
      if (touch.axis !== 'x') return;
      event.preventDefault();
      touch.dx = dx;
    };
    const end = () => {
      if (touch?.axis === 'x') {
        suppressClickUntil = Date.now() + 400;
        if (Math.abs(touch.dx) >= 45) latest.current(-Math.sign(touch.dx));
      }
      touch = null;
    };
    const cancel = () => { touch = null; };
    const click = event => {
      if (Date.now() < suppressClickUntil) { event.preventDefault(); event.stopPropagation(); }
    };
    node.addEventListener('wheel', wheel, { passive: false });
    node.addEventListener('touchstart', start, { passive: true });
    node.addEventListener('touchmove', move, { passive: false });
    node.addEventListener('touchend', end);
    node.addEventListener('touchcancel', cancel);
    node.addEventListener('click', click, true);
    return () => {
      clearTimeout(wheelTimer);
      node.removeEventListener('wheel', wheel);
      node.removeEventListener('touchstart', start);
      node.removeEventListener('touchmove', move);
      node.removeEventListener('touchend', end);
      node.removeEventListener('touchcancel', cancel);
      node.removeEventListener('click', click, true);
    };
  }, [root, enabled, view]);
}
