import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { useRef, useState } from 'preact/hooks';
import { useCalendarPan } from '../src/hooks/useCalendarPan.js';
import { addDays } from '../src/lib/domain.js';

let root;
function Calendar({ onShift, enabled = true, lockTouchAxis = false }) {
  const ref = useRef(null), [anchor, setAnchor] = useState('2026-11-02');
  useCalendarPan(ref, { anchor, selectedDate: anchor, dayCount: 7, mobileDays: 3, focusKey: 0, enabled, lockTouchAxis,
    onShift: delta => { onShift(delta); setAnchor(value => addDays(value, delta)); } });
  return <div ref={ref} class="week-scroller" data-anchor={anchor}><div class="week-axis-heading"/></div>;
}
beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(Element.prototype, 'clientWidth', 'get').mockReturnValue(752);
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({width:52});
  root = document.createElement('div'); document.body.append(root);
});

it('locks a phone gesture to its initial axis and only a horizontal swipe changes the date', async () => {
  const onShift = vi.fn();
  await act(() => render(<Calendar onShift={onShift} lockTouchAxis/>, root));
  const node = root.firstElementChild;
  const touch = (type, x, y) => {
    const event = new Event(type, { bubbles:true, cancelable:true });
    Object.defineProperty(event, 'touches', { value:type === 'touchend' ? [] : [{identifier:1,clientX:x,clientY:y}] });
    node.dispatchEvent(event);
    return event;
  };

  touch('touchstart',100,100);
  expect(touch('touchmove',96,82).defaultPrevented).toBe(false);
  expect(touch('touchmove',25,72).defaultPrevented).toBe(false);
  await act(() => touch('touchend',25,72));
  expect(node.scrollLeft).toBe(700);
  expect(onShift).not.toHaveBeenCalled();

  node.scrollTop = 280;
  touch('touchstart',100,100);
  expect(touch('touchmove',85,96).defaultPrevented).toBe(true);
  expect(touch('touchmove',40,30).defaultPrevented).toBe(true);
  expect(node.scrollLeft).toBe(760);
  expect(node.scrollTop).toBe(280);
  await act(() => touch('touchend',40,30));
  expect(onShift).toHaveBeenCalledExactlyOnceWith(1);
  expect(node.scrollLeft).toBe(700);
  expect(node.hasAttribute('data-horizontal-swipe')).toBe(false);
});
afterEach(async () => { await act(() => render(null, root)); root.remove(); vi.restoreAllMocks(); vi.useRealTimers(); });

it('uses native horizontal movement and rebases repeatedly without locking at the first day', async () => {
  const onShift = vi.fn();
  await act(() => render(<Calendar onShift={onShift}/>, root));
  const node = root.firstElementChild;
  expect(node.scrollLeft).toBe(700);
  const wheel = new WheelEvent('wheel', {deltaX:100, bubbles:true, cancelable:true});
  node.dispatchEvent(wheel);
  expect(wheel.defaultPrevented).toBe(false);
  const pan = async amount => act(() => {
    node.scrollLeft += amount;
    node.dispatchEvent(new Event('scroll'));
    node.dispatchEvent(new Event('scrollend'));
  });
  await pan(100); expect(node.dataset.anchor).toBe('2026-11-03'); expect(node.scrollLeft).toBe(700);
  await pan(300); expect(node.dataset.anchor).toBe('2026-11-06'); expect(node.scrollLeft).toBe(700);
  await pan(-200); expect(node.dataset.anchor).toBe('2026-11-04'); expect(node.scrollLeft).toBe(700);
  expect(onShift.mock.calls.map(([delta])=>delta)).toEqual([1,3,-2]);
  await act(() => {node.scrollTop=500;node.dispatchEvent(new Event('scroll'));node.dispatchEvent(new Event('scrollend'));});
  expect(onShift).toHaveBeenCalledTimes(3);
});

it('waits for touch release, yields during event dragging and cleans up on unmount', async () => {
  const onShift = vi.fn();
  await act(() => render(<Calendar onShift={onShift}/>, root));
  const node = root.firstElementChild;
  node.dispatchEvent(new Event('touchstart'));
  await act(() => {node.scrollLeft=800;node.dispatchEvent(new Event('scroll'));node.dispatchEvent(new Event('scrollend'));vi.advanceTimersByTime(200);});
  expect(onShift).not.toHaveBeenCalled();
  await act(() => {node.dispatchEvent(new Event('touchend'));node.dispatchEvent(new Event('scrollend'));});
  expect(onShift).toHaveBeenCalledExactlyOnceWith(1);
  await act(() => render(<Calendar onShift={onShift} enabled={false}/>, root));
  node.scrollLeft=900;node.dispatchEvent(new Event('scroll'));node.dispatchEvent(new Event('scrollend'));
  expect(onShift).toHaveBeenCalledTimes(1);
  await act(() => render(null, root));
  expect(vi.getTimerCount()).toBe(0);
  node.dispatchEvent(new Event('scrollend'));
  expect(onShift).toHaveBeenCalledTimes(1);
});
