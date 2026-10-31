import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { ProductDemo } from '../src/components/landing/ProductDemo.jsx';
import { EventStudio } from '../src/components/landing/EventStudio.jsx';
import { RecordNetwork } from '../src/components/landing/RecordNetwork.jsx';

let root;
const mount = async component => act(() => render(component,root));
const click = async node => { expect(node).toBeTruthy(); await act(() => node.click()); };
const button = text => [...root.querySelectorAll('button')].find(node => node.textContent.includes(text));
const input = label => [...root.querySelectorAll('label')].find(node => node.textContent.startsWith(label)).querySelector('input');
const fill = async (node,value) => act(() => { node.value=value; node.dispatchEvent(new Event('input',{bubbles:true})); });
const drag = async (node,type) => act(() => {
  const event = new Event(type,{bubbles:true,cancelable:true});
  Object.defineProperty(event,'dataTransfer',{value:{setData(){}}});
  node.dispatchEvent(event);
});
beforeEach(() => { root=document.createElement('div'); document.body.append(root); });
afterEach(async () => { await mount(null); root.remove(); vi.restoreAllMocks(); });

it('moves immediately without an editor, preserves origin and returns the card without persistence', async () => {
  const stored={...localStorage};
  await mount(<ProductDemo/>);
  expect([...root.querySelectorAll('.toy-day > header')].map(node => node.textContent)).toEqual(['Понедельник','Вторник','Среда']);
  expect(root.querySelector('.product-demo-bar')).toBeNull();
  const days=[...root.querySelectorAll('[data-demo-day]')];
  await drag(days[1].querySelector('.event-card'),'dragstart');
  await drag(days[2],'drop');
  expect(root.querySelector('dialog')).toBeNull();
  expect(days[1].querySelector('.ghost-card')).toBeTruthy();
  const moved=days[2].querySelector('[data-card-id="lesson"]');
  expect(moved.textContent).toContain('15:00–16:00');
  await drag(moved,'dragstart'); await drag(days[1],'drop');
  expect(days[1].querySelector('.ghost-card')).toBeNull();
  expect(days[1].querySelector('[data-card-id="lesson"]')).toBeTruthy();
  expect({...localStorage}).toEqual(stored);
});
it('offers the same move to touch and keyboard users through an explicit button', async () => {
  await mount(<ProductDemo/>);
  await click(root.querySelector('[aria-label="Перенести «Занятие с Анной» на следующий день примера"]'));
  expect(root.querySelectorAll('[data-demo-day]')[2].querySelector('[data-card-id="lesson"]')).toBeTruthy();
  await click(root.querySelector('.ghost-card'));
  expect(root.querySelectorAll('[data-demo-day]')[1].querySelector('[data-card-id="lesson"]')).toBeTruthy();
});
it('keeps time and duration in sync and hides preview fields in the separate editor', async () => {
  await mount(<EventStudio/>);
  await fill(input('Название'),'Подготовка к экзамену');
  await fill(input('Минут'),'90');
  expect(input('Конец').value).toBe('16:30');
  expect(root.querySelector('.event-card').textContent).toContain('Подготовка к экзамену');
  expect(root.querySelector('.event-card').textContent).toContain('15:00–16:30');
  await fill(input('Конец'),'17:00');
  expect(input('Минут').value).toBe('120');
  expect(root.querySelector('.event-card').textContent).toContain('Производные');
  await click(button('Тема'));
  expect(root.querySelector('.event-card').textContent).not.toContain('Производные');
  await act(() => root.querySelector('form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
  expect(root.textContent).toContain('Готово. Карточка обновлена');
});
it('inherits one shared name and actual link address into both connected cards', async () => {
  await mount(<RecordNetwork/>);
  await fill(root.querySelector('input'),'Мария');
  expect([...root.querySelectorAll('.network-inherited')].every(node => node.textContent.includes('Мария'))).toBe(true);
  const first=root.querySelector('.network-inherited-link').href;
  await click(root.querySelector('.network-link-change'));
  const links=[...root.querySelectorAll('.network-inherited-link')];
  expect(links[0].href).not.toBe(first);
  expect(links[0].href).toBe(links[1].href);
});
