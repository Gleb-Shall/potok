import { useEffect, useRef } from 'preact/hooks';
import { useMotionVisibility } from '../../hooks/useMotionVisibility.js';

// A small local canvas: no second WebGL context, no document-wide animation loop.
export function FlowPlayground({ paused = false }) {
  const canvas = useRef(null), controller = useRef(null);
  const control = useRef({ x: -.4, y: .35, spread: 0, dragging: false, moved: false });
  const motion = useMotionVisibility();
  useEffect(() => {
    if (typeof CanvasRenderingContext2D === 'undefined') return;
    const node = canvas.current, ctx = node.getContext('2d');
    if (!ctx) return;
    let frame = 0, last = 0, turn = 0, size = 400, spread = 0;
    let x = control.current.x, y = control.current.y;
    const animate = motion.active && !paused;
    const project = (px, py, pz) => {
      const cy = Math.cos(y), sy = Math.sin(y), cx = Math.cos(x), sx = Math.sin(x);
      const ax = px * cy + pz * sy, az = pz * cy - px * sy;
      const ay = py * cx - az * sx, z = py * sx + az * cx;
      const perspective = 4 / (4 + z);
      return [size / 2 + ax * size * .26 * perspective, size / 2 + ay * size * .26 * perspective, z];
    };
    function draw(time = 0) {
      frame = 0;
      if (animate && time && time - last < 1000 / 30) { frame = requestAnimationFrame(draw); return; }
      const dt = Math.min(.05, (time - last) / 1000 || .016); last = time;
      const ease = motion.reduced || paused ? 1 : 1 - Math.exp(-dt * 12), state = control.current;
      x += (state.x - x) * ease; y += (state.y - y) * ease; spread += (state.spread - spread) * ease;
      if (animate && !state.dragging) turn += dt * .13;
      ctx.clearRect(0, 0, size, size);
      const faces = [], steps = 64;
      for (let ring = 0; ring < 3; ring++) {
        const vertices = [];
        for (let i = 0; i <= steps; i++) {
          const t = i / steps * Math.PI * 2, a = t + turn + ring * .6;
          for (const edge of [-1, 1]) {
            const radius = 1.05 + edge * .13;
            const px = Math.cos(a) * radius, py = Math.sin(a) * radius;
            const tilt = ring * Math.PI / 3 + spread * .65;
            vertices.push(project(px, py * Math.cos(tilt) + Math.sin(a * 2) * spread * .17,
              py * Math.sin(tilt) + (ring - 1) * spread * .7));
          }
          if (i) {
            const points = [vertices[i * 2 - 2], vertices[i * 2 - 1], vertices[i * 2 + 1], vertices[i * 2]];
            faces.push({ points, depth: points.reduce((sum, p) => sum + p[2], 0) / 4, ring });
          }
        }
      }
      faces.sort((a, b) => b.depth - a.depth);
      for (const face of faces) {
        ctx.beginPath(); face.points.forEach(([px, py], i) => i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)); ctx.closePath();
        ctx.fillStyle = face.ring === 1 ? '#252823' : face.ring === 2 ? '#f2b28e' : '#ff652f';
        ctx.fill();
      }
      const settling = Math.abs(state.x - x) + Math.abs(state.y - y) + Math.abs(state.spread - spread) > .001;
      if (animate || settling && !motion.reduced) frame = requestAnimationFrame(draw);
    }
    const invalidate = () => { if (!frame) frame = requestAnimationFrame(draw); };
    const resize = () => {
      size = node.clientWidth || 400;
      const ratio = Math.min(devicePixelRatio || 1, 1.5);
      node.width = Math.ceil(size * ratio); node.height = Math.ceil(size * ratio);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0); invalidate();
    };
    controller.current = { invalidate };
    const observer = new ResizeObserver(resize); observer.observe(node); resize();
    return () => { cancelAnimationFrame(frame); observer.disconnect(); controller.current = null; };
  }, [motion.active, motion.reduced, paused]);
  const start = event => {
    const state = control.current; state.dragging = true; state.moved = false;
    state.lastX = event.clientX; state.lastY = event.clientY;
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const move = event => {
    const state = control.current;
    if (!state.dragging) return;
    const dx = event.clientX - state.lastX, dy = event.clientY - state.lastY;
    if (Math.abs(dx) + Math.abs(dy) > 1) state.moved = true;
    state.y += dx * .012; state.x += dy * .012;
    state.lastX = event.clientX; state.lastY = event.clientY; controller.current?.invalidate();
  };
  const stop = () => { control.current.dragging = false; };
  const toggle = () => { if (!control.current.moved) { control.current.spread = 1 - control.current.spread; controller.current?.invalidate(); } control.current.moved = false; };
  return <div class="flow-playground" ref={motion.ref}>
    <button class="flow-playground-button" type="button" aria-label="Повернуть объёмный Поток. Перетащи мышью или нажми, чтобы изменить форму" onPointerDown={start} onPointerMove={move} onPointerUp={stop} onPointerCancel={stop} onLostPointerCapture={stop} onClick={toggle} onKeyDown={event => {
      if (event.key === 'Enter' || event.key === ' ') control.current.moved = false;
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
      event.preventDefault(); const state = control.current;
      if (event.key === 'ArrowLeft') state.y -= .2; if (event.key === 'ArrowRight') state.y += .2;
      if (event.key === 'ArrowUp') state.x -= .2; if (event.key === 'ArrowDown') state.x += .2;
      controller.current?.invalidate();
    }}><canvas ref={canvas} aria-hidden="true"/></button>
    <p>Потяни, чтобы повернуть. Нажми, чтобы раскрыть.</p>
  </div>;
}
