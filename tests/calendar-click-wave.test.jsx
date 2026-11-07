import { expect, it, vi } from 'vitest';
import { createRef, render } from 'preact';
import { act } from 'preact/test-utils';
import { CalendarClickWave } from '../src/components/CalendarClickWave.jsx';
import { ANIMATION_QUALITY_KEY } from '../src/lib/appearance.js';

it('sends a wave through the grid and into the next card after a delay', async () => {
  const root = document.createElement('div'), scheduleRef = createRef();
  const drawing = Object.fromEntries(['clearRect','setTransform','fillText','save','beginPath','rect','clip','restore'].map(name => [name,vi.fn()]));
  let pending, now = 0;
  const previousQuality = localStorage.getItem(ANIMATION_QUALITY_KEY);
  localStorage.setItem(ANIMATION_QUALITY_KEY,'balanced');
  vi.stubGlobal('requestAnimationFrame',callback => { pending=callback; return 1; });
  vi.stubGlobal('cancelAnimationFrame',() => { pending=null; });
  vi.spyOn(performance,'now').mockImplementation(() => now);
  vi.spyOn(document,'hidden','get').mockReturnValue(false);
  vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue(drawing);
  document.body.append(root);
  try {
    await act(() => render(<section ref={scheduleRef}><div class="week-scroller">
      <article data-event-id="source"><button class="card-open">Первое событие</button></article>
      <article data-event-id="neighbor"><button class="card-open">Второе событие</button></article>
    </div><CalendarClickWave scheduleRef={scheduleRef}/></section>,root));
    const grid = root.querySelector('.week-scroller'), canvas = root.querySelector('canvas');
    grid.getBoundingClientRect = () => ({left:0,top:0});
    Object.defineProperties(grid,{clientWidth:{value:300},clientHeight:{value:120}});
    root.querySelector('[data-event-id=neighbor]').getBoundingClientRect = () => ({left:105,top:25,right:170,bottom:65});
    const click = () => root.querySelector('.card-open').dispatchEvent(new MouseEvent('click',{bubbles:true,detail:1,clientX:25,clientY:45}));
    click();
    expect(canvas.hidden).toBe(false);
    expect(drawing.fillText.mock.calls.some(([,x,y]) => Math.hypot(x-25,y-45) < 20)).toBe(true);
    now=175; pending();
    expect(drawing.clip).not.toHaveBeenCalled();
    expect(drawing.fillText.mock.calls.some(([,x]) => x > 60)).toBe(true);
    now=250; pending();
    expect(drawing.rect).toHaveBeenCalledWith(105,25,65,40);
    now=1000; pending();
    expect(canvas.hidden).toBe(true);
    expect(canvas.width).toBe(1);
    expect(pending).toBeNull();
    localStorage.setItem(ANIMATION_QUALITY_KEY,'economy');
    click();
    expect(canvas.hidden).toBe(true);
  } finally {
    await act(() => render(null,root));
    root.remove();
    if (previousQuality === null) localStorage.removeItem(ANIMATION_QUALITY_KEY);
    else localStorage.setItem(ANIMATION_QUALITY_KEY,previousQuality);
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  }
});
