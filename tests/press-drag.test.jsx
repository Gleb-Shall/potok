import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { attachPressDrag } from '../src/hooks/usePressDrag.js';
import { ProductDemo } from '../src/components/landing/ProductDemo.jsx';
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
it('moves a real landing card by touch and restores its original day', async () => {
  await act(() => render(<ProductDemo/>,root));
  const days = [...root.querySelectorAll('[data-demo-day]')];
  Object.defineProperty(document,'elementFromPoint',{configurable:true,value:vi.fn(() => days[2])});
  let card = root.querySelector('[data-card-id="lesson"]');
  await act(() => { touch(card,'touchstart'); vi.advanceTimersByTime(360); });
  expect(document.querySelector('.press-drag-ghost')).not.toBeNull();
  await act(() => { touch(card,'touchmove',90,180); touch(card,'touchend',90,180); });
  expect(days[2].querySelector('[data-card-id="lesson"]')).not.toBeNull();
  expect(document.querySelector('.press-drag-ghost')).toBeNull();
  document.elementFromPoint.mockReturnValue(days[1]); card = root.querySelector('[data-card-id="lesson"]');
  await act(() => { touch(card,'touchstart'); vi.advanceTimersByTime(360); });
  await act(() => { touch(card,'touchmove',80,140); touch(card,'touchend',80,140); });
  expect(days[1].querySelector('[data-card-id="lesson"]')).not.toBeNull();
  expect(days[1].querySelector('.ghost-card')).toBeNull();
});
it('opens fourteen target dates from a calendar hold and opens time editing only after a drop', async () => {
  localStorage.clear();
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
