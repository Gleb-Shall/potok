import { useEffect, useRef } from 'preact/hooks';
import { APPEARANCE_CHANGE, readAnimationQuality } from '../lib/appearance.js';

const GLYPHS = ' .,:;+=*#%@';
const LIFE = 720;
const CELL = 9;

export default function SelectedCardMotion({ cardRef, smoke, liveText, paused, title }) {
  const canvasRef = useRef(null), pulsed = useRef(false);
  useEffect(() => {
    const card = cardRef.current, canvas = canvasRef.current;
    if (!card || paused) return;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const context = canvas?.getContext('2d');
    if (!context && !liveText) return;
    const moveEvent = typeof PointerEvent === 'function' ? 'pointermove' : 'mousemove';
    let visible = true, frame = 0, previousDraw = -Infinity;
    let rect, dirty = true, letters = [], x = 0, y = 0, lastMove = -Infinity, lastSeed = -Infinity;
    let quality = readAnimationQuality(), ink = '', trail = [];
    let scale = 1;
    const canAnimate = () => visible && !document.hidden && !reduced.matches && quality !== 'economy';
    const clearCanvas = () => {
      if (!context) return;
      context.setTransform(1,0,0,1,0,0);
      context.clearRect(0,0,canvas.width,canvas.height);
    };
    const clear = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      trail.length = 0;
      previousDraw = lastMove = lastSeed = -Infinity;
      letters.forEach(({node}) => {node.style.transform = '';});
      clearCanvas();
    };
    const measure = () => {
      rect = card.getBoundingClientRect();
      if (!rect.width || !rect.height) return false;
      dirty = false;
      const nodes = liveText ? Array.from(card.querySelectorAll('[data-motion-letter]')) : [];
      for (const node of nodes) node.style.transform = '';
      letters = nodes.map(node => {
        const box = node.getBoundingClientRect();
        return {node, x:box.left + box.width/2 - rect.left, y:box.top + box.height/2 - rect.top};
      });
      if (context) {
        ink = getComputedStyle(card).getPropertyValue('--accent').trim() || '#d75c32';
        scale = Math.min(window.devicePixelRatio || 1, 1.5, 640 / Math.max(rect.width,rect.height));
        const width = Math.max(1,Math.ceil(rect.width*scale)), height = Math.max(1,Math.ceil(rect.height*scale));
        if (canvas.width !== width) canvas.width = width;
        if (canvas.height !== height) canvas.height = height;
      }
      return true;
    };
    const drawSmoke = now => {
      if (!context || !trail.length) return;
      context.setTransform(scale,0,0,scale,0,0);
      context.font = '10px ui-monospace, monospace';
      context.textBaseline = 'middle';
      context.fillStyle = ink;
      const cell = Math.max(quality === 'high' ? 8 : CELL, Math.ceil(Math.sqrt(rect.width*rect.height/1100)));
      for (let gy=cell/2; gy<rect.height; gy+=cell) {
        for (let gx=cell/2; gx<rect.width; gx+=cell) {
          let density = 0;
          for (const seed of trail) {
            const age = (now-seed.at)/LIFE;
            const dx = gx-seed.x-Math.sin(age*4+gy*.032)*age*30;
            const dy = gy-seed.y+age*18;
            const spread = 200+age*1100;
            density += Math.exp(-(dx*dx+dy*dy)/spread)*Math.max(0,1-age)*.58;
          }
          density *= .57+.43*Math.sin(gx*.24+gy*.35-now*.012);
          const level = Math.min(GLYPHS.length-1,Math.floor(density*GLYPHS.length));
          if (level < 1) continue;
          context.globalAlpha = Math.min(.45,.17+density*.3);
          context.fillText(GLYPHS[level],gx,gy);
        }
      }
      context.globalAlpha = 1;
    };
    const paint = () => {
      frame = 0;
      const now = performance.now();
      if (!canAnimate()) {clear();return;}
      if (dirty && !measure()) {clear();return;}
      if (context && !pulsed.current) {
        pulsed.current = true;
        if (!trail.length) trail.push({x:rect.width*.73,y:rect.height*.64,at:now});
      }
      if (now-previousDraw >= 30) {
        previousDraw = now;
        while (trail.length && now-trail[0].at >= LIFE) trail.shift();
        if (context) {
          clearCanvas();
          drawSmoke(now);
        }
        if (liveText) {
          const strength = Math.max(0,1-(now-lastMove)/320);
          for (const letter of letters) {
            const dx = letter.x-x, dy = letter.y-y, distance = Math.hypot(dx,dy);
            const offset = distance < 46 ? (1-distance/46)**2*9*strength/Math.max(distance,1) : 0;
            letter.node.style.transform = offset ? `translate(${(dx*offset).toFixed(2)}px,${(dy*offset).toFixed(2)}px)` : '';
          }
        }
      }
      if (trail.length || now-lastMove<350) wake();
    };
    const wake = () => { if (!frame && canAnimate()) frame=requestAnimationFrame(paint); };
    const wakePulse = () => { if (context && !pulsed.current) wake(); };
    const invalidate = () => { dirty = true; wakePulse(); };
    const move = event => {
      if (event.pointerType === 'touch' || !canAnimate()) return;
      const bounds = card.getBoundingClientRect();
      if (!bounds.width || !bounds.height) return;
      x = event.clientX-bounds.left; y=event.clientY-bounds.top;
      lastMove = performance.now();
      if (context && lastMove-lastSeed > 38) {
        lastSeed = lastMove;
        if (trail.length === 9) trail.shift();
        trail.push({x,y,at:lastMove});
      }
      wake();
    };
    const change = () => {quality=readAnimationQuality();clear();};
    const resize = typeof ResizeObserver==='function' ? new ResizeObserver(invalidate) : null;
    const intersection = typeof IntersectionObserver==='function' ? new IntersectionObserver(([entry]) => {
      visible=entry.isIntersecting;
      if (visible) invalidate(); else clear();
    }) : null;
    resize?.observe(card); intersection?.observe(card);
    card.addEventListener(moveEvent,move,{passive:true});
    document.addEventListener('visibilitychange',clear);
    window.addEventListener(APPEARANCE_CHANGE,change);
    if (reduced.addEventListener) reduced.addEventListener('change',clear);
    else reduced.addListener?.(clear);
    wakePulse();
    return () => {
      clear();resize?.disconnect();intersection?.disconnect();
      card.removeEventListener(moveEvent,move);
      document.removeEventListener('visibilitychange',clear);
      window.removeEventListener(APPEARANCE_CHANGE,change);
      if (reduced.removeEventListener) reduced.removeEventListener('change',clear);
      else reduced.removeListener?.(clear);
    };
  },[cardRef,smoke,liveText,paused,title]);
  return smoke ? <canvas class="card-ascii-smoke" ref={canvasRef} aria-hidden="true"/> : null;
}
