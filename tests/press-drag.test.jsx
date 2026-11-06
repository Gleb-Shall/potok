import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { attachPressDrag } from '../src/hooks/usePressDrag.js';
import { App } from '../src/App.jsx';

let root, dispose;
const touch = (target, type, x = 20, y = 20, count = 1) => {
  const event = new Event(type, { bubbles: true, cancelable: true });
  const changed = Array.from({ length: count }, (_, identifier) => ({ identifier, clientX:x, clientY:y }));
  Object.defineProperties(event, { touches:{ value:type === 'touchend' || type === 'touchcancel' ? [] : changed }, changedTouches:{ value:changed } });
  target.dispatchEvent(event);
  return event;
};
beforeEach(() => { vi.useFakeTimers(); root = document.createElement('div'); document.body.append(root); });
afterEach(async () => { dispose?.(); dispose = null; await act(() => render(null,root)); root.remove(); vi.useRealTimers(); vi.restoreAllMocks(); });
const setup = () => {
  root.innerHTML = '<article data-id="one"><button class="card-open">Open</button><a href="#link">Link</a></article>';
  const options = { enabled:true, selector:'article', getItem:() => ({ id:'one' }), onStart:vi.fn(), onMove:vi.fn(), onEnd:vi.fn(), onDrop:vi.fn(), hitTest:() => '2026-11-06' };
  dispose = attachPressDrag({ current:root },options);
  return { options, card:root.querySelector('article'), button:root.querySelector('button') };
};
it('leaves short taps and pre-hold scrolling untouched', () => {
  const {options,button} = setup();
  touch(button,'touchstart'); touch(button,'touchend'); vi.advanceTimersByTime(400);
  expect(options.onStart).not.toHaveBeenCalled();
  touch(button,'touchstart'); const swipe = touch(button,'touchmove',20,45); vi.advanceTimersByTime(400);
  expect(swipe.defaultPrevented).toBe(false);
  expect(options.onStart).not.toHaveBeenCalled();
});
it('holds, follows the finger, drops once and suppresses the trailing click', () => {
  const {options,button,card} = setup();
  touch(button,'touchstart'); vi.advanceTimersByTime(360);
  expect(options.onStart).toHaveBeenCalledOnce(); expect(card.dataset.pressDragging).toBe('true');
  expect(touch(button,'touchmove',50,120).defaultPrevented).toBe(true);
  touch(button,'touchend',50,120);
  expect(options.onDrop).toHaveBeenCalledWith({id:'one'},'2026-11-06');
  expect(card.hasAttribute('data-press-dragging')).toBe(false);
  const click = new MouseEvent('click',{bubbles:true,cancelable:true,detail:1}); button.dispatchEvent(click);
  expect(click.defaultPrevented).toBe(true);
});
it('cancels a stationary hold, interrupted gestures and multi-touch without a drop', () => {
  const {options,button} = setup();
  touch(button,'touchstart'); vi.advanceTimersByTime(360); touch(button,'touchend');
  touch(button,'touchstart'); vi.advanceTimersByTime(360); touch(button,'touchmove',80,90); touch(button,'touchcancel');
  touch(button,'touchstart'); touch(button,'touchstart',20,20,2); vi.advanceTimersByTime(400);
  expect(options.onStart).toHaveBeenCalledTimes(2); expect(options.onDrop).not.toHaveBeenCalled();
});
it('does not capture links and releases listeners on cleanup', () => {
  const {options,button} = setup();
  touch(root.querySelector('a'),'touchstart'); vi.advanceTimersByTime(400);
  expect(options.onStart).not.toHaveBeenCalled();
  touch(button,'touchstart'); dispose(); vi.advanceTimersByTime(400);
  expect(options.onStart).not.toHaveBeenCalled();
});

it('opens fourteen target dates from a calendar hold and opens time editing only after a drop', async () => {
  localStorage.clear();localStorage.setItem('potok:week-layout','board');
  HTMLDialogElement.prototype.showModal = vi.fn();
  HTMLDialogElement.prototype.close = vi.fn();
  await act(() => render(<App initialMode="demo" demoOnly/>,root));
  const card = root.querySelector('[data-event-id]:not([data-event-state="confirmed"])');
  expect(card).not.toBeNull();
  await act(() => { touch(card.querySelector('.card-open'),'touchstart'); vi.advanceTimersByTime(360); });
  const targets = [...document.querySelectorAll('[data-press-drop]')];
  expect(targets).toHaveLength(14);
  expect(document.querySelector('.touch-move-picker')).not.toBeNull();
  const target = targets.find(node => !node.classList.contains('is-source'));
  Object.defineProperty(document,'elementFromPoint',{configurable:true,value:vi.fn(() => target)});
  await act(() => { touch(card,'touchmove',100,450); touch(card,'touchend',100,450); });
  expect(document.querySelector('.touch-move-picker')).toBeNull();
  expect(document.body.textContent).toContain('Во сколько начать?');
});

it('offers fourteen dates from the move button and cancels a drop on the source day', async () => {
  localStorage.clear();localStorage.setItem('potok:week-layout','board');
  await act(() => render(<App initialMode="demo" demoOnly/>,root));
  await act(() => root.querySelector('.card-move').click());
  expect(document.querySelectorAll('[data-press-drop]')).toHaveLength(14);
  expect(document.querySelector('.press-drag-ghost')).toBeNull();
  await act(() => document.querySelector('.touch-move-days .is-source').click());
  expect(document.querySelector('.touch-move-picker')).toBeNull();
  expect(document.querySelector('dialog')).toBeNull();
});
it('moves a native mouse drag within the board without opening the mini calendar', async () => {
  localStorage.clear();localStorage.setItem('potok:week-layout','board');
  await act(() => render(<App initialMode="demo" demoOnly/>,root));
  const card = root.querySelector('[data-event-id]'),id=card.dataset.eventId;
  const originalTime=card.querySelector('.card-time').textContent.split('–')[0];
  const drag = new Event('dragstart',{bubbles:true,cancelable:true});
  Object.defineProperty(drag,'dataTransfer',{value:{setData:vi.fn(),setDragImage:vi.fn()}});
  await act(() => card.dispatchEvent(drag));
  expect(document.querySelector('.touch-move-picker')).toBeNull();
  const columns=[...root.querySelectorAll('.day-column')];
  const target=columns.at(-1);
  const drop = new Event('drop',{bubbles:true,cancelable:true});
  await act(() => target.dispatchEvent(drop));
  expect(document.querySelector('dialog')).toBeNull();
  const saved=JSON.parse(localStorage.getItem('tutor-schedule:demo:v2'));
  const moved=saved.events.find(event=>event.id===id);
  expect(moved.date).toBe(target.dataset.boardDrop);expect(moved.start).toBe(Number(originalTime.slice(0,2))*60+Number(originalTime.slice(3,5)));
});
it('keeps deferring an event available inside the new date picker', async () => {
  localStorage.clear();localStorage.setItem('potok:week-layout','board');
  await act(() => render(<App initialMode="demo" demoOnly/>,root));
  await act(() => root.querySelector('.card-move').click());
  await act(() => document.querySelector('.touch-move-pending').click());
  expect(document.querySelector('.touch-move-picker')).toBeNull();
  expect(root.querySelectorAll('.pending-card')).toHaveLength(1);
  expect(root.querySelector('.pending-panel').classList.contains('has-pending')).toBe(true);
});
it('opens fourteen dates by holding the mouse, then follows and drops without opening details', async () => {
  localStorage.clear();localStorage.setItem('potok:week-layout','board');
  HTMLDialogElement.prototype.showModal = vi.fn();
  HTMLDialogElement.prototype.close = vi.fn();
  await act(() => render(<App initialMode="demo" demoOnly/>,root));
  const card = root.querySelector('[data-event-id]');
  const press = (target,type,x=20,y=20) => target.dispatchEvent(new MouseEvent(type,{bubbles:true,cancelable:true,button:0,buttons:type==='mouseup'?0:1,clientX:x,clientY:y}));
  await act(() => { press(card.querySelector('.card-open'),'mousedown'); vi.advanceTimersByTime(360); });
  expect(document.querySelectorAll('[data-press-drop]')).toHaveLength(14);
  expect(document.querySelector('.press-drag-ghost')).not.toBeNull();
  const nativeAttempt = new Event('dragstart',{bubbles:true,cancelable:true});
  await act(() => card.dispatchEvent(nativeAttempt));
  expect(nativeAttempt.defaultPrevented).toBe(true);
  expect(document.querySelector('.press-drag-ghost')).not.toBeNull();
  const target = document.querySelector('[data-press-drop]:not(.is-source)');
  Object.defineProperty(document,'elementFromPoint',{configurable:true,value:vi.fn(() => target)});
  await act(() => { press(document,'mousemove',150,250); press(document,'mouseup',150,250); });
  expect(document.querySelector('.touch-move-picker')).toBeNull();
  expect(document.body.textContent).toContain('Во сколько начать?');
});
it('keeps quick mouse clicks and immediate native dragging available', () => {
  const {options,button} = setup();
  button.dispatchEvent(new MouseEvent('mousedown',{bubbles:true,button:0,buttons:1}));
  button.dispatchEvent(new MouseEvent('mouseup',{bubbles:true,button:0,buttons:0}));
  vi.advanceTimersByTime(400);
  expect(options.onStart).not.toHaveBeenCalled();
  const click=new MouseEvent('click',{bubbles:true,cancelable:true,detail:1}); button.dispatchEvent(click);
  expect(click.defaultPrevented).toBe(false);
  button.dispatchEvent(new MouseEvent('mousedown',{bubbles:true,button:0,buttons:1}));
  const native=new Event('dragstart',{bubbles:true,cancelable:true}); button.dispatchEvent(native);
  vi.advanceTimersByTime(400);
  expect(native.defaultPrevented).toBe(false);
  expect(options.onStart).not.toHaveBeenCalled();
});

it('quick horizontal touch movement starts a board gesture while vertical movement still scrolls', () => {
 const {options,button}=setup();options.quickDrag=true;
 touch(button,'touchstart');const vertical=touch(button,'touchmove',20,55);
 expect(vertical.defaultPrevented).toBe(false);expect(options.onStart).not.toHaveBeenCalled();
 touch(button,'touchstart');const horizontal=touch(button,'touchmove',60,22);
 expect(horizontal.defaultPrevented).toBe(true);expect(options.onStart.mock.calls[0][0].mode).toBe('board');
 vi.advanceTimersByTime(400);expect(options.onStart).toHaveBeenCalledTimes(1);
 touch(button,'touchend',60,22);expect(options.onDrop).toHaveBeenCalledWith({id:'one'},'2026-11-06','board');
});
it('drops a quick finger drag onto a visible week day without opening the date picker',async()=>{
 localStorage.clear();localStorage.setItem('potok:week-layout','board');await act(()=>render(<App initialMode="demo" demoOnly/>,root));
 const card=root.querySelector('[data-event-id]'),id=card.dataset.eventId;
 const target=[...root.querySelectorAll('.mobile-day[data-board-drop]')].at(-1);
 Object.defineProperty(document,'elementFromPoint',{configurable:true,value:vi.fn(()=>target)});
 await act(()=>touch(card.querySelector('.card-open'),'touchstart'));
 await act(()=>touch(card,'touchmove',80,22));
 expect(document.querySelector('.touch-move-picker')).toBeNull();
 expect(document.querySelector('.press-drag-ghost')).not.toBeNull();
 await act(()=>touch(card,'touchend',80,22));
 const saved=JSON.parse(localStorage.getItem('tutor-schedule:demo:v2'));
 expect(saved.events.find(event=>event.id===id).date).toBe(target.dataset.boardDrop);
 expect(document.querySelector('.touch-move-picker')).toBeNull();expect(document.querySelector('dialog')).toBeNull();
});
