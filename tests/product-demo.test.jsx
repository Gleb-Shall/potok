import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { ProductDemo } from '../src/components/landing/ProductDemo.jsx';

let root;
const click = async node => { expect(node).toBeTruthy(); await act(() => node.click()); };
const button = text => [...root.querySelectorAll('button')].find(node => node.textContent.includes(text));
const fill = async (node, value) => { await act(() => { node.value = value; node.dispatchEvent(new Event('input', { bubbles:true })); }); };
const submit = async () => act(() => root.querySelector('dialog form').dispatchEvent(new Event('submit', { bubbles:true, cancelable:true })));
const drag = async (node, type) => act(() => {
  const event = new Event(type, { bubbles:true, cancelable:true });
  Object.defineProperty(event, 'dataTransfer', { value:{ setData() {}, setDragImage() {} } });
  node.dispatchEvent(event);
});
beforeEach(async () => {
  root = document.createElement('div'); document.body.append(root);
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; };
  vi.stubGlobal('requestAnimationFrame', callback => { callback(); return 0; });
  await act(() => render(<ProductDemo/>, root));
});
afterEach(async () => { await act(() => render(null, root)); root.remove(); vi.unstubAllGlobals(); });

it('moves a real card, keeps its origin and restores it by dragging back without persistence', async () => {
  const stored = { ...localStorage };
  const days = [...root.querySelectorAll('[data-demo-day]')];
  await drag(days[1].querySelector('.event-card'), 'dragstart');
  await drag(days[2], 'drop');
  expect(root.querySelector('dialog h2').textContent).toBe('Перенести событие');
  await fill(root.querySelector('input[type=time]'), '16:00');
  await submit();
  expect(days[1].querySelector('.ghost-card')).toBeTruthy();
  const moved = [...days[2].querySelectorAll('.event-card')].find(node => node.textContent.includes('Анной'));
  expect(moved.textContent).toContain('16:00–17:00');
  await drag(moved, 'dragstart');
  await drag(days[1], 'drop');
  expect(days[1].querySelector('.ghost-card')).toBeNull();
  expect(days[1].querySelector('.event-card').textContent).toContain('15:00–16:00');
  expect({ ...localStorage }).toEqual(stored);
});

it('retains the chosen time when opening advanced editing after a drop', async () => {
  const days = [...root.querySelectorAll('[data-demo-day]')];
  await drag(days[1].querySelector('.event-card'), 'dragstart');
  await drag(days[2], 'drop');
  await fill(root.querySelector('input[type=time]'), '16:30');
  await click(button('Расширенное редактирование'));
  expect(root.querySelector('input[type=time]').value).toBe('16:30');
  expect(root.querySelector('input[type=date]').value).toBe(days[2].dataset.demoDay);
});

it('creates a linked record inside the event editor and returns to its preserved draft', async () => {
  await click(root.querySelector('.demo-add'));
  const type = root.querySelector('dialog select');
  await act(() => { type.value = 'class'; type.dispatchEvent(new Event('change', { bubbles:true })); });
  await click(root.querySelector('[aria-label="Создать связанную запись"]'));
  const name = [...root.querySelectorAll('label')].find(node => node.textContent.startsWith('Название или имя')).querySelector('input');
  await fill(name, 'Новый предмет');
  await submit();
  expect(root.querySelector('dialog h2').textContent).toBe('Новое событие');
  expect(root.querySelector('dialog select').value).toBe('class');
  expect([...root.querySelectorAll('dialog select')][1].selectedOptions[0].textContent).toBe('Новый предмет');
});
