import { useEffect, useRef, useState } from 'preact/hooks';
import { useMotionVisibility } from '../../hooks/useMotionVisibility.js';

// Six continuous SVG surfaces replace the per-frame canvas mesh and depth sort.
// Frames are requested only for input/inertia; the settled sculpture has no JS loop.
const BAND = 'M200 20a180 180 0 1 1 0 360a180 180 0 1 1 0-360ZM200 66a134 134 0 1 0 0 268a134 134 0 1 0 0-268Z';
const INITIAL = { x: -24, y: 28 };
export function FlowPlayground({ paused = false }) {
  const [open, setOpen] = useState(false);
  const object = useRef(null), controller = useRef(null);
  const state = useRef({ ...INITIAL, vx: 0, vy: 0, dragging: false, moved: false, pointer: null });
  const motion = useMotionVisibility();
  const active = motion.active && !paused;
  useEffect(() => {
    let frame = 0, last = 0;
    const paint = () => {
      const s = state.current;
      object.current.style.transform = `rotateX(${s.x}deg) rotateY(${s.y}deg)`;
    };
    const stop = () => { cancelAnimationFrame(frame); frame = 0; state.current.vx = state.current.vy = 0; };
    const draw = time => {
      frame = 0;
      const s = state.current, dt = Math.min(32, time - last || 16); last = time;
      if (!s.dragging && active) {
        s.x += s.vx * dt; s.y += s.vy * dt;
        const decay = Math.exp(-dt / 180);
        s.vx *= decay; s.vy *= decay;
      }
      paint();
      if (active && !s.dragging && Math.abs(s.vx) + Math.abs(s.vy) > .003) frame = requestAnimationFrame(draw);
    };
    const invalidate = () => { if (!frame) { last = 0; frame = requestAnimationFrame(draw); } };
    paint();
    if (!active) stop();
    controller.current = { invalidate, stop };
    return () => { stop(); controller.current = null; };
  }, [active]);
  const start = event => {
    if (event.button !== 0) return;
    controller.current?.stop();
    const s = state.current;
    s.dragging = true; s.moved = false; s.pointer = event.pointerId;
    s.startX = s.lastX = event.clientX; s.startY = s.lastY = event.clientY;
    s.lastTime = event.timeStamp;
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const move = event => {
    const s = state.current;
    if (!s.dragging || event.pointerId !== s.pointer) return;
    const dx = event.clientX - s.lastX, dy = event.clientY - s.lastY;
    const dt = Math.max(8, event.timeStamp - s.lastTime);
    if (Math.hypot(event.clientX - s.startX, event.clientY - s.startY) > 5) s.moved = true;
    s.x -= dy * .45; s.y += dx * .45;
    s.vx = Math.max(-.6, Math.min(.6, -dy * .45 / dt));
    s.vy = Math.max(-.6, Math.min(.6, dx * .45 / dt));
    s.lastX = event.clientX; s.lastY = event.clientY; s.lastTime = event.timeStamp;
    controller.current?.invalidate();
  };
  const stop = event => {
    const s = state.current;
    if (s.pointer !== event.pointerId) return;
    s.dragging = false; s.pointer = null;
    if (event.type !== 'pointerup' || event.timeStamp - s.lastTime > 80) s.vx = s.vy = 0;
    controller.current?.invalidate();
  };
  const reset = () => {
    controller.current?.stop();
    Object.assign(state.current, INITIAL, { dragging: false, moved: false, pointer: null });
    setOpen(false); controller.current?.invalidate();
  };
  return <div class="flow-playground" ref={motion.ref} data-open={open} data-still={paused || motion.reduced || !motion.active}>
    <button class="flow-playground-button" type="button" aria-label="Объёмные ленты: перетащи, чтобы повернуть; нажми, чтобы раскрыть" aria-pressed={open}
      onPointerDown={start} onPointerMove={move} onPointerUp={stop} onPointerCancel={stop} onLostPointerCapture={stop}
      onClick={event => { if (!event.detail || !state.current.moved) setOpen(value => !value); state.current.moved = false; }}
      onKeyDown={event => {
        if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home'].includes(event.key)) return;
        event.preventDefault();
        if (event.key === 'Home') { reset(); return; }
        controller.current?.stop();
        const s = state.current;
        if (event.key === 'ArrowLeft') s.y -= 15; if (event.key === 'ArrowRight') s.y += 15;
        if (event.key === 'ArrowUp') s.x += 15; if (event.key === 'ArrowDown') s.x -= 15;
        controller.current?.invalidate();
      }}>
      <span class="flow-sculpture" ref={object} aria-hidden="true">{[0, 1, 2].map(index => <span class={`flow-band flow-band-${index}`} key={index}>
        <svg class="flow-band-face flow-band-front" viewBox="0 0 400 400"><path fillRule="evenodd" d={BAND}/><path class="flow-band-notch" d="M190 21h20v46h-20z"/></svg>
        <svg class="flow-band-face flow-band-back" viewBox="0 0 400 400"><path fillRule="evenodd" d={BAND}/></svg>
      </span>)}</span>
    </button>
    <div class="flow-playground-controls"><button type="button" onClick={() => setOpen(value => !value)}>{open ? 'Собрать' : 'Раскрыть'} <span aria-hidden="true">{open ? '−' : '+'}</span></button><button type="button" onClick={reset}>Сначала <span aria-hidden="true">↺</span></button></div>
  </div>;
}
