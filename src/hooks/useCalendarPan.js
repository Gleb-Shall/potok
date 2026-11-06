import { useEffect, useLayoutEffect, useRef } from 'preact/hooks';

export const CALENDAR_BUFFER_DAYS = 7;

// Let the browser own drag, trackpad momentum and snapping. Rebase only after
// scrolling settles, keeping a bounded strip of dates on either side of the view.
export function useCalendarPan(scroller, { anchor, selectedDate, dayCount, mobileDays, focusKey, enabled, onShift }) {
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
    const start = () => { touching = true; clearTimeout(idleTimer.current); };
    const end = event => { touching = Boolean(event.touches?.length); if (!touching) schedule(); };
    node.addEventListener('scroll', scroll, { passive: true });
    node.addEventListener('scrollend', settle);
    node.addEventListener('touchstart', start, { passive: true });
    node.addEventListener('touchend', end, { passive: true });
    node.addEventListener('touchcancel', end, { passive: true });
    return () => {
      clearTimeout(idleTimer.current);
      node.removeEventListener('scroll', scroll);
      node.removeEventListener('scrollend', settle);
      node.removeEventListener('touchstart', start);
      node.removeEventListener('touchend', end);
      node.removeEventListener('touchcancel', end);
    };
  }, [scroller, enabled]);
}
