import { useEffect, useRef, useState } from 'preact/hooks';

// Optional board drags start on movement; a stationary hold opens the date picker.
export function attachPressDrag(root, options) {
  let gesture, timer, suppressUntil = 0, lastTouchAt = -Infinity;
  const read = () => options.current || options;
  const point = input => ({ x: input.clientX, y: input.clientY });
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
    document.removeEventListener('mousemove', moveMouse);
    document.removeEventListener('mouseup', endMouse);
  };
  const cancel = () => stop();
  const activate = mode => {
    clearTimeout(timer);
    gesture.active = true; gesture.mode = mode;
    gesture.node.setAttribute('data-press-dragging', 'true');
    const style = getComputedStyle(gesture.node);
    read().onStart?.({item:gesture.item,point:gesture.last,background:style.backgroundColor,color:style.color,mode});
  };
  const track = (event, next) => {
    if (!gesture.active) {
      if (distance(next, gesture.origin) <= 9) return;
      const horizontal = Math.abs(next.x-gesture.origin.x) > Math.abs(next.y-gesture.origin.y);
      if (read().quickDrag && (gesture.kind === 'mouse' || horizontal || gesture.quickHandle)) activate('board');
      else { stop(); return; }
    }
    if (event.cancelable) event.preventDefault();
    gesture.moved ||= distance(next, gesture.origin) > 9;
    gesture.last = next;
    read().onMove?.(next,gesture.mode);
  };
  const finish = (event, next) => {
    const current = gesture;
    if (current.active && event.cancelable) event.preventDefault();
    const drop = current.active && current.moved ? read().hitTest?.(next,current.mode) : null;
    stop();
    if (drop) { if(current.mode==='board') read().onDrop?.(current.item,drop,'board');else read().onDrop?.(current.item,drop); }
  };
  const move = event => {
    if (gesture?.kind !== 'touch') return;
    if (event.touches.length !== 1) return stop();
    const touch = Array.from(event.touches).find(item => item.identifier === gesture.id);
    if (!touch) return stop();
    track(event, point(touch));
  };
  const end = event => {
    lastTouchAt = Date.now();
    if (gesture?.kind !== 'touch') return;
    const touch = Array.from(event.changedTouches).find(item => item.identifier === gesture.id);
    if (touch) finish(event, point(touch));
  };
  const moveMouse = event => {
    if (gesture?.kind !== 'mouse') return;
    if (!(event.buttons & 1)) return stop();
    track(event, point(event));
  };
  const endMouse = event => { if (gesture?.kind === 'mouse' && event.button === 0) finish(event, point(event)); };
  const begin = (event, input, kind) => {
    stop(); suppressUntil = 0;
    const config = read();
    if (!config.enabled) return;
    const target = event.target;
    const node = target.closest?.(config.selector);
    if (!node || !root.current?.contains(node) || node.closest('[inert]')) return;
    if (target.closest('a,input,select,textarea,[contenteditable=true],.card-controls') || target.closest('button:not(.card-open)')) return;
    const item = config.getItem(node,point(input));
    if (!item) return;
    gesture = { node, item, kind, id:input.identifier, origin:point(input), last:point(input), active:false, moved:false, quickHandle:Boolean(target.closest('.card-grip')) };
    if (kind === 'touch') {
      document.addEventListener('touchmove', move, { passive:false });
      document.addEventListener('touchend', end, { passive:false });
      document.addEventListener('touchcancel', cancel);
    } else {
      document.addEventListener('mousemove', moveMouse);
      document.addEventListener('mouseup', endMouse);
    }
    timer = setTimeout(() => {
      if (!gesture) return;
      activate('calendar');
    }, 360);
  };
  const start = event => {
    lastTouchAt = Date.now();
    if (event.touches.length !== 1) { stop(); return; }
    begin(event, event.touches[0], 'touch');
  };
  const startMouse = event => {
    if (event.button !== 0 || Date.now() - lastTouchAt < 800) return;
    begin(event, event, 'mouse');
  };
  const click = event => { if (Date.now() < suppressUntil && event.detail !== 0) { event.preventDefault(); event.stopImmediatePropagation(); } };
  const nativeDrag = event => {
    if (gesture?.active) { event.preventDefault(); event.stopImmediatePropagation(); }
    else if (gesture?.kind === 'mouse' && event.type === 'dragstart') stop();
  };
  const visibility = () => { if (document.hidden) stop(); };
  const escape = event => { if(event.key==='Escape' && gesture?.active) {event.preventDefault();stop();} };
  document.addEventListener('touchstart', start, { passive:true });
  document.addEventListener('mousedown', startMouse);
  document.addEventListener('click', click, true);
  document.addEventListener('dragstart', nativeDrag, true);
  document.addEventListener('contextmenu', nativeDrag, true);
  window.addEventListener('blur', cancel);
  window.addEventListener('pagehide', cancel);
  document.addEventListener('visibilitychange', visibility);
  document.addEventListener('keydown',escape);
  const dispose = () => {
    stop();
    document.removeEventListener('touchstart', start);
    document.removeEventListener('mousedown', startMouse);
    document.removeEventListener('click', click, true);
    document.removeEventListener('dragstart', nativeDrag, true);
    document.removeEventListener('contextmenu', nativeDrag, true);
    window.removeEventListener('blur', cancel);
    window.removeEventListener('pagehide', cancel);
    document.removeEventListener('visibilitychange', visibility);
    document.removeEventListener('keydown',escape);
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
    onStart: value => { setDrag(value); config.onActiveChange?.(true,value.mode,value.item); paint(value.point); },
    onMove: (point,mode) => { paint(point);const target=config.hitTest(point,mode);setHover(target);config.onHover?.(target,mode); },
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
