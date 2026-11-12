import { useEffect, useLayoutEffect, useRef } from 'preact/hooks';

export const CALENDAR_BUFFER_DAYS = 7;

// Desktop scrolling stays native. The phone keeps native vertical scrolling
// and moves the date strip only after a horizontal touch gesture is recognized.
export function useCalendarPan(scroller, { anchor, selectedDate, dayCount, mobileDays, focusKey, enabled, lockTouchAxis = false, onShift }) {
  const latest = useRef(onShift);
  latest.current = onShift;
  const position = useRef({ column: 0, base: 0, lastX: 0, committing: false });
  const idleTimer = useRef(null);

  useLayoutEffect(() => {
    const node = scroller.current;
    if (!node) return;
    let layoutKey = '';
    const align = () => {
      const axis = node.querySelector('.week-axis-heading')?.getBoundingClientRect().width || 0;
      const mobile = window.matchMedia('(max-width: 760px)').matches;
      const visible = dayCount === 1 ? 1 : mobile ? mobileDays : dayCount;
      const column = (node.clientWidth - axis) / visible;
      if (column <= 0) return;
      const key = `${column}:${visible}`;
      if (layoutKey === key) return; // Height-only changes must not reset a swipe.
      layoutKey = key;
      const selected = Math.min(dayCount-1, Math.max(0, Math.round((Date.parse(selectedDate) - Date.parse(anchor)) / 86400000)));
      const offset = mobile && dayCount > 1 ? Math.floor(selected / visible) * visible : 0;
      const base = (CALENDAR_BUFFER_DAYS + offset) * column;
      clearTimeout(idleTimer.current);
      node.style.setProperty('--week-column', `${column}px`);
      node.scrollLeft = base;
      position.current = { column, base, lastX: node.scrollLeft, committing: false };
    };
    align();
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(align) : null;
    observer?.observe(node);
    window.addEventListener('resize', align);
    return () => { observer?.disconnect(); window.removeEventListener('resize', align); };
  }, [scroller, anchor, selectedDate, dayCount, mobileDays, focusKey]);

  useEffect(() => {
    const node = scroller.current;
    if (!enabled || !node) return;
    let touching = false;
    let swipe = null;
    const nativeEnd = 'onscrollend' in node;
    const settle = () => {
      clearTimeout(idleTimer.current);
      const current = position.current;
      if (touching || !current.column || current.committing) return;
      const delta = Math.round((node.scrollLeft - current.base) / current.column);
      if (!delta) return;
      current.committing = true;
      latest.current(delta);
    };
    const schedule = () => {
      if (nativeEnd) return;
      clearTimeout(idleTimer.current);
      idleTimer.current = setTimeout(settle, 160); // Fallback for older WebKit.
    };
    const scroll = () => {
      if (node.scrollLeft === position.current.lastX) return;
      position.current.lastX = node.scrollLeft;
      schedule();
    };
    const resetSwipe = () => {
      if (swipe?.axis === 'x') node.scrollLeft = swipe.left;
      swipe = null;
      node.removeAttribute('data-horizontal-swipe');
    };
    const start = event => {
      touching = true;
      clearTimeout(idleTimer.current);
      if (!lockTouchAxis) return;
      resetSwipe();
      if (event.touches?.length !== 1 ||
          event.target.closest?.('.week-resize-handle,.timeline-card.is-card-selected,a,button:not(.card-open)')) return;
      const { identifier, clientX, clientY } = event.touches[0];
      swipe = { identifier, x:clientX, y:clientY, left:node.scrollLeft, axis:null };
    };
    const move = event => {
      if (!swipe || swipe.axis === 'y') return;
      if (event.touches.length !== 1 || event.touches[0].identifier !== swipe.identifier ||
          event.target.closest?.('[data-press-dragging]')) {
        resetSwipe();
        return;
      }
      const dx = event.touches[0].clientX - swipe.x;
      const dy = event.touches[0].clientY - swipe.y;
      if (!swipe.axis) {
        if (Math.hypot(dx, dy) < 9) return;
        swipe.axis = event.cancelable && Math.abs(dx) > Math.abs(dy) * 1.25 ? 'x' : 'y';
        if (swipe.axis === 'y') return;
        node.setAttribute('data-horizontal-swipe', '');
      }
      if (!event.cancelable) { resetSwipe(); return; }
      event.preventDefault();
      const column = position.current.column;
      node.scrollLeft = swipe.left - Math.max(-column, Math.min(column, dx));
    };
    const end = event => {
      touching = Boolean(event.touches?.length);
      if (touching) return;
      if (swipe?.axis === 'x') {
        if (event.type === 'touchend' && event.cancelable) event.preventDefault();
        const threshold = Math.max(36, position.current.column * .16);
        const distance = node.scrollLeft - swipe.left;
        if (event.type === 'touchend' && Math.abs(distance) >= threshold) {
          swipe = null;
          node.removeAttribute('data-horizontal-swipe');
          position.current.committing = true;
          latest.current(Math.sign(distance));
          return;
        }
      }
      resetSwipe();
      schedule();
    };
    node.addEventListener('scroll', scroll, { passive: true });
    node.addEventListener('scrollend', settle);
    node.addEventListener('touchstart', start, { passive: true });
    if (lockTouchAxis) node.addEventListener('touchmove', move, { passive: false });
    node.addEventListener('touchend', end, { passive: !lockTouchAxis });
    node.addEventListener('touchcancel', end, { passive: true });
    return () => {
      clearTimeout(idleTimer.current);
      resetSwipe();
      node.removeEventListener('scroll', scroll);
      node.removeEventListener('scrollend', settle);
      node.removeEventListener('touchstart', start);
      node.removeEventListener('touchmove', move);
      node.removeEventListener('touchend', end);
      node.removeEventListener('touchcancel', end);
    };
  }, [scroller, enabled, lockTouchAxis]);
}
