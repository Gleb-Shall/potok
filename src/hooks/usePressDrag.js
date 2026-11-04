import { useEffect, useRef, useState } from 'preact/hooks';

// Touch scrolling stays native until the hold completes. No idle animation loop.
export function attachPressDrag(root, options) {
  let gesture, timer, suppressUntil = 0;
  const read = () => options.current || options;
  const point = touch => ({ x: touch.clientX, y: touch.clientY });
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const stop = () => {
    clearTimeout(timer);
    if (gesture?.active) {
      suppressUntil = Date.now() + 700;
      gesture.node.removeAttribute('data-press-dragging');
      read().onEnd?.();
    }
    gesture = null;
    document.removeEventListener('touchmove', move);
    document.removeEventListener('touchend', end);
    document.removeEventListener('touchcancel', cancel);
  };
  const cancel = () => stop();
  const move = event => {
    if (!gesture) return;
    if (event.touches.length !== 1) return stop();
    const touch = Array.from(event.touches).find(item => item.identifier === gesture.id);
    if (!touch) return stop();
    const next = point(touch);
    if (!gesture.active) { if (distance(next, gesture.origin) > 9) stop(); return; }
    if (event.cancelable) event.preventDefault();
    gesture.moved ||= distance(next, gesture.origin) > 9;
    gesture.last = next;
    read().onMove?.(next);
  };
  const end = event => {
    if (!gesture || !Array.from(event.changedTouches).some(item => item.identifier === gesture.id)) return;
    const current = gesture;
    const touch = Array.from(event.changedTouches).find(item => item.identifier === current.id);
    const next = point(touch);
    if (current.active && event.cancelable) event.preventDefault();
    const drop = current.active && current.moved ? read().hitTest?.(next) : null;
    stop();
    if (drop) read().onDrop?.(current.item, drop);
  };
  const start = event => {
    stop(); suppressUntil = 0;
    const config = read();
    if (!config.enabled || event.touches.length !== 1) return;
    const target = event.target;
    const node = target.closest?.(config.selector);
    if (!node || !root.current?.contains(node) || node.closest('[inert]')) return;
    if (target.closest('a,input,select,textarea,[contenteditable=true],.card-controls') || target.closest('button:not(.card-open)')) return;
    const item = config.getItem(node);
    if (!item) return;
    const touch = event.touches[0];
    gesture = { node, item, id: touch.identifier, origin: point(touch), last: point(touch), active: false, moved: false };
    document.addEventListener('touchmove', move, { passive: false });
    document.addEventListener('touchend', end, { passive: false });
    document.addEventListener('touchcancel', cancel);
    timer = setTimeout(() => {
      if (!gesture) return;
      gesture.active = true;
      node.setAttribute('data-press-dragging', 'true');
      const style = getComputedStyle(node);
      read().onStart?.({ item, point: gesture.last, background: style.backgroundColor, color: style.color });
    }, 360);
  };
  const click = event => { if (Date.now() < suppressUntil && event.detail !== 0) { event.preventDefault(); event.stopImmediatePropagation(); } };
  const nativeDrag = event => { if (gesture?.active) event.preventDefault(); };
  const visibility = () => { if (document.hidden) stop(); };
  document.addEventListener('touchstart', start, { passive: true });
  document.addEventListener('click', click, true);
  document.addEventListener('dragstart', nativeDrag, true);
  document.addEventListener('contextmenu', nativeDrag, true);
  window.addEventListener('blur', cancel);
  window.addEventListener('pagehide', cancel);
  document.addEventListener('visibilitychange', visibility);
  const dispose = () => {
    stop();
    document.removeEventListener('touchstart', start);
    document.removeEventListener('click', click, true);
    document.removeEventListener('dragstart', nativeDrag, true);
    document.removeEventListener('contextmenu', nativeDrag, true);
    window.removeEventListener('blur', cancel);
    window.removeEventListener('pagehide', cancel);
    document.removeEventListener('visibilitychange', visibility);
  };
  dispose.cancel = stop;
  return dispose;
}

export function usePressDrag(config) {
  const [drag, setDrag] = useState(null);
  const [hover, setHover] = useState(null);
  const ghostRef = useRef(null);
  const options = useRef(null);
  const frame = useRef(0);
  const last = useRef(null);
  const cancelRef = useRef(null);
  const paint = point => {
    last.current = point;
    if (!frame.current) frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      if (ghostRef.current) ghostRef.current.style.transform = `translate3d(${last.current.x}px,${last.current.y}px,0)`;
    });
  };
  options.current = {
    ...config,
    onStart: value => { setDrag(value); config.onActiveChange?.(true); paint(value.point); },
    onMove: point => { paint(point); setHover(config.hitTest(point)); },
    onEnd: () => { setDrag(null); setHover(null); config.onActiveChange?.(false); cancelAnimationFrame(frame.current); frame.current = 0; },
  };
  useEffect(() => {
    const dispose = attachPressDrag(config.root, options);
    cancelRef.current = dispose.cancel;
    return () => { dispose(); cancelAnimationFrame(frame.current); };
  }, [config.root, config.enabled]);
  return { drag, hover, ghostRef, cancel: () => { cancelRef.current?.(); setDrag(null); setHover(null); } };
}

export const touchDropTarget = (point, selector, attribute) => document.elementFromPoint(point.x, point.y)?.closest(selector)?.getAttribute(attribute) || null;
