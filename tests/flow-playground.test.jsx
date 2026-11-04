import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { FlowPlayground } from '../src/components/landing/FlowPlayground.jsx';

const visibility = vi.hoisted(() => ({ active: true, reduced: false }));
vi.mock('../src/hooks/useMotionVisibility.js', () => ({ useMotionVisibility: () => ({ ...visibility, ref: { current: null } }) }));
let root, queue, nextId, time;
const mount = component => act(() => render(component, root));
const frame = () => {
  time += 16;
  const pending = [...queue.values()]; queue.clear();
  pending.forEach(callback => callback(time));
};
const pointer = (button, type, x, y, timestamp) => {
  const event = new Event(type, { bubbles: true });
  Object.defineProperties(event, Object.fromEntries(Object.entries({button:0,pointerId:1,clientX:x,clientY:y,timeStamp:timestamp}).map(([key,value]) => [key,{value}])));
  button.dispatchEvent(event);
};
beforeEach(() => {
  root = document.createElement('div'); document.body.append(root);
  queue = new Map(); nextId = time = 0;
  visibility.active = true; visibility.reduced = false;
  vi.stubGlobal('requestAnimationFrame', callback => { queue.set(++nextId,callback); return nextId; });
  vi.stubGlobal('cancelAnimationFrame', id => queue.delete(id));
});
afterEach(async () => { await mount(null); root.remove(); vi.unstubAllGlobals(); });

it('does not schedule frames at rest and uses continuous vector surfaces', async () => {
  await mount(<FlowPlayground/>);
  expect(queue.size).toBe(0);
  expect(root.querySelector('canvas')).toBeNull();
  expect(root.querySelectorAll('svg')).toHaveLength(6);
  await act(() => root.querySelector('.flow-playground-controls button').click());
  expect(root.querySelector('.flow-playground').dataset.open).toBe('true');
  expect(queue.size).toBe(0);
});
it('lets inertia settle, suppresses accidental clicks after dragging and resets from the keyboard', async () => {
  await mount(<FlowPlayground/>);
  const button = root.querySelector('.flow-playground-button');
  button.setPointerCapture = vi.fn();
  const initial = root.querySelector('.flow-sculpture').style.transform;
  pointer(button,'pointerdown',100,100,16);
  pointer(button,'pointermove',160,125,32); frame();
  pointer(button,'pointerup',160,125,48);
  await act(() => button.dispatchEvent(new MouseEvent('click',{bubbles:true,detail:1})));
  expect(root.querySelector('.flow-playground').dataset.open).toBe('false');
  let frames = 0;
  while (queue.size && frames < 120) { frame(); frames++; }
  expect(frames).toBeGreaterThan(0);
  expect(frames).toBeLessThan(120);
  expect(queue.size).toBe(0);
  expect(root.querySelector('.flow-sculpture').style.transform).not.toBe(initial);
  await act(() => button.dispatchEvent(new KeyboardEvent('keydown',{bubbles:true,key:'Home'}))); frame();
  expect(root.querySelector('.flow-sculpture').style.transform).toBe(initial);
});
it('cancels inertia when hidden, paused or unmounted', async () => {
  await mount(<FlowPlayground/>);
  const button = root.querySelector('.flow-playground-button'); button.setPointerCapture = vi.fn();
  const fling = () => { pointer(button,'pointerdown',0,0,16); pointer(button,'pointermove',50,10,32); pointer(button,'pointerup',50,10,48); };
  fling(); expect(queue.size).toBe(1);
  visibility.active = false; await mount(<FlowPlayground/>);
  expect(queue.size).toBe(0);
  visibility.active = true; await mount(<FlowPlayground/>);
  fling(); await mount(<FlowPlayground paused/>); expect(queue.size).toBe(0);
  await mount(<FlowPlayground/>); fling(); await mount(null); expect(queue.size).toBe(0);
});
it('keeps keyboard controls usable with reduced motion without an inertia loop', async () => {
  visibility.active = false; visibility.reduced = true;
  await mount(<FlowPlayground/>);
  const object = root.querySelector('.flow-sculpture'), before = object.style.transform;
  root.querySelector('.flow-playground-button').dispatchEvent(new KeyboardEvent('keydown',{bubbles:true,key:'ArrowRight'})); frame();
  expect(object.style.transform).not.toBe(before);
  expect(queue.size).toBe(0);
  expect(root.querySelector('.flow-playground').dataset.still).toBe('true');
});
