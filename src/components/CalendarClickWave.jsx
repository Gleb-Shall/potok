import { useEffect, useRef } from 'preact/hooks';
import { APPEARANCE_CHANGE, readAnimationQuality } from '../lib/appearance.js';

const WAVE_DURATION = 580;
const CARD_DELAY = 50;
const CARD_DURATION = 270;
const GLYPHS = '.:+*#';
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function CalendarClickWave({ scheduleRef }) {
  const canvasRef = useRef(null);
  useEffect(() => {
    const schedule = scheduleRef.current, canvas = canvasRef.current;
    if (!schedule) return;
    const motion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    let frame = 0;
    const stop = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      canvas.hidden = true;
      if (canvas.width !== 1) canvas.width = 1;
      if (canvas.height !== 1) canvas.height = 1;
    };
    const click = event => {
      if (event.detail < 1 || document.hidden || motion?.matches) return;
      const source = event.target.closest?.('[data-event-id] .card-open');
      const grid = source?.closest('.week-scroller, .calendar-scroll');
      if (!grid) return;
      const quality = readAnimationQuality();
      if (quality === 'economy') return;
      const gridRect = grid.getBoundingClientRect(), panel = schedule.getBoundingClientRect();
      const left = Math.max(0, gridRect.left + grid.clientLeft);
      const top = Math.max(0, gridRect.top + grid.clientTop);
      const width = Math.floor(Math.min(window.innerWidth, gridRect.left + grid.clientLeft + grid.clientWidth) - left);
      const height = Math.floor(Math.min(window.innerHeight, gridRect.top + grid.clientTop + grid.clientHeight) - top);
      const x = event.clientX-left, y = event.clientY-top;
      if (width <= 0 || height <= 0 || x < 0 || x > width || y < 0 || y > height) return;
      const context = canvas.getContext('2d');
      if (!context) return;
      stop();
      const scale = Math.min(window.devicePixelRatio || 1, 1.5, 1440 / Math.max(width,height));
      canvas.width = Math.ceil(width*scale);
      canvas.height = Math.ceil(height*scale);
      Object.assign(canvas.style, {
        left:`${left-panel.left-schedule.clientLeft}px`, top:`${top-panel.top-schedule.clientTop}px`,
        width:`${width}px`, height:`${height}px`,
      });
      canvas.hidden = false;
      context.setTransform(scale,0,0,scale,0,0);
      context.font = '12px ui-monospace, monospace';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillStyle = getComputedStyle(schedule).getPropertyValue('--accent').trim() || '#d75c32';

      const reach = Math.hypot(Math.max(x,width-x),Math.max(y,height-y));
      const cell = Math.max(quality === 'high' ? 12 : 15, Math.ceil(Math.sqrt(width*height/4800)));
      const columns = Math.ceil(width/cell), rows = Math.ceil(height/cell);
      const occupied = new Uint8Array(columns*rows);
      const sourceCard = source.closest('[data-event-id]');
      const cards = [];
      for (const card of grid.querySelectorAll('[data-event-id]')) {
        if (card === sourceCard) continue;
        const rect = card.getBoundingClientRect();
        const x0 = Math.max(0,rect.left-left), x1 = Math.min(width,rect.right-left);
        const y0 = Math.max(0,rect.top-top), y1 = Math.min(height,rect.bottom-top);
        if (x0 >= x1 || y0 >= y1) continue;
        const hitX = clamp(x,x0,x1), hitY = clamp(y,y0,y1);
        const hitAt = Math.hypot(hitX-x,hitY-y)/reach*WAVE_DURATION + CARD_DELAY;
        const echoReach = Math.hypot(Math.max(hitX-x0,x1-hitX),Math.max(hitY-y0,y1-hitY));
        const firstCol = Math.ceil(x0/cell-.5), lastCol = Math.floor(x1/cell-.5);
        const firstRow = Math.ceil(y0/cell-.5), lastRow = Math.floor(y1/cell-.5);
        for (let row=firstRow; row<=lastRow; row++) {
          occupied.fill(1,row*columns+firstCol,row*columns+lastCol+1);
        }
        cards.push({x0,x1,y0,y1,hitX,hitY,hitAt,echoReach});
      }
      const duration = cards.reduce((end,card) => Math.max(end,card.hitAt+CARD_DURATION),WAVE_DURATION);
      const start = performance.now();
      let lastDraw = -Infinity;
      const paint = () => {
        const elapsed = performance.now()-start;
        if (elapsed >= duration) { stop(); return; }
        frame = requestAnimationFrame(paint);
        if (elapsed-lastDraw < 28) return;
        lastDraw = elapsed;
        context.clearRect(0,0,width,height);
        if (elapsed < WAVE_DURATION) {
          const progress = elapsed/WAVE_DURATION;
          const radius = Math.max(cell/2,reach*progress);
          for (let row=0; row<rows; row++) {
            const gy = (row+.5)*cell;
            for (let col=0; col<columns; col++) {
              if (occupied[row*columns+col]) continue;
              const gx = (col+.5)*cell;
              const crest = 1-Math.abs(Math.hypot(gx-x,gy-y)-radius)/(cell*1.5);
              if (crest <= 0) continue;
              context.globalAlpha = crest*(.78-progress*.35);
              context.fillText(GLYPHS[Math.floor(crest*(GLYPHS.length-1))],gx,gy);
            }
          }
        }
        for (const card of cards) {
          const progress = (elapsed-card.hitAt)/CARD_DURATION;
          if (progress < 0 || progress >= 1) continue;
          context.save();
          context.beginPath();
          context.rect(card.x0,card.y0,card.x1-card.x0,card.y1-card.y0);
          context.clip();
          const step = 9, radius = progress*card.echoReach;
          for (let gy=card.y0+step/2; gy<card.y1; gy+=step) {
            for (let gx=card.x0+step/2; gx<card.x1; gx+=step) {
              const crest = 1-Math.abs(Math.hypot(gx-card.hitX,gy-card.hitY)-radius)/(step*2);
              if (crest <= 0) continue;
              context.globalAlpha = crest*(1-progress)*.9;
              context.fillText(GLYPHS[Math.floor(crest*(1-progress)*(GLYPHS.length-1))],gx,gy);
            }
          }
          context.restore();
        }
      };
      paint();
    };
    schedule.addEventListener('click',click);
    window.addEventListener('scroll',stop,true);
    window.addEventListener('resize',stop);
    window.addEventListener(APPEARANCE_CHANGE,stop);
    document.addEventListener('visibilitychange',stop);
    motion?.addEventListener?.('change',stop);
    return () => {
      stop();
      schedule.removeEventListener('click',click);
      window.removeEventListener('scroll',stop,true);
      window.removeEventListener('resize',stop);
      window.removeEventListener(APPEARANCE_CHANGE,stop);
      document.removeEventListener('visibilitychange',stop);
      motion?.removeEventListener?.('change',stop);
    };
  },[scheduleRef]);
  return <canvas ref={canvasRef} class="calendar-click-wave" width="1" height="1" hidden aria-hidden="true"/>;
}
