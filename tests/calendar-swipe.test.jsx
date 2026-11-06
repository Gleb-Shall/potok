import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { useRef } from 'preact/hooks';
import { useCalendarSwipe } from '../src/hooks/useCalendarSwipe.js';

let root;
function Calendar({ onShift, enabled = true }) {
  const ref = useRef(null);
  useCalendarSwipe(ref, onShift, enabled, 'week');
  return <section ref={ref}><div class="week-scroller"><div class="week-day-lane"/><article data-event-id="one"/></div></section>;
}
const touch = (target, type, x, y, count = 1) => {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'touches', { value: type === 'touchend' || type === 'touchcancel' ? [] :
    Array.from({ length: count }, (_, identifier) => ({ identifier, clientX: x, clientY: y })) });
  target.dispatchEvent(event);
  return event;
};
beforeEach(() => { vi.useFakeTimers(); root = document.createElement('div'); document.body.append(root); });
afterEach(async () => { await act(() => render(null, root)); root.remove(); vi.useRealTimers(); });

it('shifts on an empty-lane swipe while leaving vertical scrolling and card dragging alone', async () => {
  const onShift = vi.fn();
  await act(() => render(<Calendar onShift={onShift}/>, root));
  const lane = root.querySelector('.week-day-lane'), card = root.querySelector('article');
  touch(lane, 'touchstart', 200, 200);
  expect(touch(lane, 'touchmove', 100, 202).defaultPrevented).toBe(true);
  touch(lane, 'touchend', 100, 202);
  expect(onShift).toHaveBeenCalledExactlyOnceWith(1);
  touch(lane, 'touchstart', 200, 200);
  expect(touch(lane, 'touchmove', 198, 100).defaultPrevented).toBe(false);
  touch(lane, 'touchend', 198, 100);
  touch(card, 'touchstart', 200, 200); touch(card, 'touchmove', 100, 200); touch(card, 'touchend', 100, 200);
  expect(onShift).toHaveBeenCalledTimes(1);
});

it('cancels interrupted and multi-finger swipes and removes listeners/timers when disabled', async () => {
  const onShift = vi.fn();
  await act(() => render(<Calendar onShift={onShift}/>, root));
  const lane = root.querySelector('.week-day-lane');
  touch(lane, 'touchstart', 200, 200); touch(lane, 'touchmove', 100, 200); touch(lane, 'touchcancel', 100, 200);
  touch(lane, 'touchstart', 200, 200); touch(lane, 'touchmove', 100, 200, 2); touch(lane, 'touchend', 100, 200);
  expect(onShift).not.toHaveBeenCalled();
  lane.dispatchEvent(new WheelEvent('wheel', { deltaX: 20, bubbles: true, cancelable: true }));
  expect(vi.getTimerCount()).toBe(1);
  await act(() => render(<Calendar onShift={onShift} enabled={false}/>, root));
  expect(vi.getTimerCount()).toBe(0);
  expect(lane.dispatchEvent(new WheelEvent('wheel', { deltaX: 100, bubbles: true, cancelable: true }))).toBe(true);
  touch(lane, 'touchstart', 200, 200); touch(lane, 'touchmove', 100, 200); touch(lane, 'touchend', 100, 200);
  expect(onShift).not.toHaveBeenCalled();
});
