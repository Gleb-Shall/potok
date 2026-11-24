import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { MonthSelector } from '../src/components/MonthSelector.jsx';
import { PendingEventCard } from '../src/components/PendingEvents.jsx';
import { TransfersView } from '../src/components/TransfersView.jsx';
import { HistoryView } from '../src/components/HistoryView.jsx';
import { JournalView } from '../src/components/JournalView.jsx';
import { StatisticsView } from '../src/components/StatisticsView.jsx';
import { GuideView } from '../src/components/GuideView.jsx';
import { defaultTypes, moveEvent } from '../src/lib/events.js';

let root;
const data = () => ({students:[],records:[],types:defaultTypes(),series:[],events:[]});
const event = () => ({id:'lesson',title:'Консультация',typeId:'class',date:'2026-10-30',anchorDate:'2026-10-30',start:600,duration:60,status:'planned',fields:{},history:[]});
beforeEach(() => { root=document.createElement('div'); document.body.append(root); });
afterEach(async () => { await act(()=>render(null,root)); root.remove(); });
const mount = element => act(()=>render(element,root));
const click = selector => act(()=>root.querySelector(selector).click());

it('month navigation crosses year boundaries in both directions',async () => {
  const change=vi.fn();
  await mount(<MonthSelector value="2026-01" onChange={change}/>);
  await click('[aria-label="Предыдущий месяц: Период"]');
  expect(change).toHaveBeenLastCalledWith('2025-12');
  await mount(<MonthSelector value="2026-12" onChange={change}/>);
  await click('[aria-label="Следующий месяц: Период"]');
  expect(change).toHaveBeenLastCalledWith('2027-01');
});

it('pending rows keep open, remind, move and restore as separate actions',async () => {
  const pending=moveEvent(event(),null,600,60), open=vi.fn(), remind=vi.fn(), move=vi.fn(), restore=vi.fn();
  await mount(<PendingEventCard data={data()} event={pending} onOpen={open} onRemind={remind} onMove={move} onRestore={restore}/>);
  await click('.pending-open'); expect(open).toHaveBeenCalledWith(pending.id);
  const buttons=[...root.querySelectorAll('.pending-card-actions > .button')];
  await act(()=>buttons[0].click()); expect(remind).toHaveBeenCalledWith(pending);
  await act(()=>buttons[1].click()); expect(move).toHaveBeenCalledWith(pending);
  await click('[aria-haspopup="menu"]');
  await click('[role="menuitem"]'); expect(restore).toHaveBeenCalledWith(pending);
  expect(open).toHaveBeenCalledTimes(1);
});

it('journal pending rows show the last scheduled slot before deferral',async () => {
  const rescheduled=moveEvent(event(),'2026-11-06',1020,45);
  const pending=moveEvent(rescheduled,null,1020,45);
  await mount(<PendingEventCard journal data={data()} event={pending} onOpen={vi.fn()} onRemind={vi.fn()} onMove={vi.fn()}/>);
  const time=root.querySelector('.activity-time');
  expect(time.querySelector('small').textContent).toBe('6 нояб.');
  expect(time.querySelector('span').textContent).toBe('17:00–17:45');
});

it('transfer history opens the stored event by id',async () => {
  const workspace=data(), open=vi.fn();
  workspace.events=[moveEvent(event(),'2026-11-01',660,60)];
  await mount(<TransfersView data={workspace} pending={[]} renderPending={()=>null} onOpen={open}/>);
  await click('.activity-open'); expect(open).toHaveBeenCalledWith('lesson');
  expect(root.textContent).toContain('1 изменение');
  expect(root.textContent).toContain('11:00');
});

it('history keeps named links clickable and confirms the exact occurrence',async () => {
  const workspace=data(), entry=event(), status=vi.fn(), open=vi.fn();
  workspace.types.find(type=>type.id==='class').fields.push({id:'call',type:'url',label:'Встреча',linkLabel:'Подключиться',showOnCard:true});
  entry.fields.call='https://example.com/call'; workspace.events=[entry];
  await mount(<HistoryView data={workspace} now={Date.parse('2026-10-31T12:00:00Z')} onOpen={open} onStatus={status}/>);
  expect(root.querySelector('a').textContent).toBe('Подключиться');
  expect(root.querySelector('a').closest('button')).toBeNull();
  expect(root.textContent).not.toContain('https://');
  await click('[aria-label="Отметить проведённым: Консультация"]');
  expect(status).toHaveBeenCalledWith(expect.objectContaining({id:entry.id,date:entry.date}),'done');
  expect(open).not.toHaveBeenCalled();
});

it('journal keeps the confirmation queue above both archive views',async () => {
  const workspace=data(), old=event(), newest={...old,id:'new',date:'2026-11-05',title:'Последняя встреча'};
  const status=vi.fn();
  const pending=moveEvent({...old,id:'pending'},null,600,60);
  workspace.events=[old,pending,newest];
  await mount(<JournalView data={workspace} now={Date.parse('2026-11-07T12:00:00Z')} pending={[pending]}
    renderPending={item=><span key={item.id}>Ожидает новой даты</span>} onOpenEvent={vi.fn()} onOpenTransfer={vi.fn()} onStatus={status}/>);
  const queue=root.querySelector('.journal-view > section');
  expect([...queue.querySelectorAll('.activity-identity strong')].map(item=>item.textContent)).toEqual([newest.title,old.title]);
  await click('[aria-label="Отменить событие: Последняя встреча"]');
  expect(status).toHaveBeenCalledWith(newest,'cancelled');
  expect(root.querySelector('.history-view .activity-row')).toBeNull();
  await click('.journal-archive .week-layout-switch button:last-child');
  expect(queue.querySelectorAll('.activity-row')).toHaveLength(2);
  expect(root.textContent).toContain('Последние изменения');
  expect(root.textContent).toContain('Ожидает новой даты');
});

it('statistics facets follow one another and a selected group narrows the event list',async () => {
  const workspace=data();
  workspace.students=[{id:'anna',name:'Анна'},{id:'pavel',name:'Павел'}];
  workspace.events=[
    {...event(),id:'anna-lesson',typeId:'lesson',recordId:'anna',status:'done',fields:{rate:1000}},
    {...event(),id:'pavel-lesson',typeId:'lesson',recordId:'pavel',status:'done',fields:{rate:0}},
    {...event(),id:'anna-class',recordId:'anna',status:'done'},
  ];
  await mount(<StatisticsView data={workspace} now={Date.parse('2026-10-31T12:00:00Z')} onOpen={vi.fn()}/>);
  const report=root.querySelector('[role="tab"][aria-selected="true"]');
  expect(report.textContent).toBe('Отчёт');
  expect(root.querySelector('.statistics-analysis .statistics-totals')).not.toBeNull();
  await act(()=>report.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true})));
  expect(document.activeElement.textContent).toBe('События');
  await click('[role="tab"]:first-child');
  const choose=async (select,value)=>act(()=>{select.value=value;select.dispatchEvent(new Event('change',{bubbles:true}));});
  const record=root.querySelector('[aria-label="Запись для статистики"]');
  const findSelect=label=>[...root.querySelectorAll('.statistics-view label')].find(item=>item.firstElementChild?.textContent===label).querySelector('select');
  const type=findSelect('Шаблон события');
  await choose(record,'pavel');
  expect([...type.options].map(option=>option.value)).toEqual(['','lesson']);
  await choose(record,'');
  await choose(type,'lesson');
  const measure=findSelect('Что считать');
  await choose(measure,[...measure.options].find(option=>option.textContent.includes('Стоимость')).value);
  await choose(findSelect('Разбить по'),'record');
  expect(root.querySelector('.statistics-result strong').textContent).toMatch(/1\s000 ₽/);
  const group=[...root.querySelectorAll('.statistics-groups button')].find(button=>button.textContent.includes('Павел'));
  await act(()=>group.click());
  expect(root.querySelectorAll('.statistics-events .activity-open')).toHaveLength(1);
  expect(root.querySelector('[role="tab"][aria-selected="true"]').textContent).toBe('События');
  expect(root.querySelector('.statistics-events .statistics-amount').textContent).toBe('0 ₽');
});

it('lets the user add a statistics condition before there are completed events', async () => {
  const workspace = data();
  workspace.types = [];
  await mount(<StatisticsView data={workspace} now={Date.parse('2026-10-31T12:00:00Z')} onOpen={vi.fn()}/>);
  await click('.statistics-advanced summary');
  await click('.statistics-advanced > button');
  const fields = root.querySelector('.statistics-filter-row select');
  expect([...fields.options].map(option=>option.value)).toEqual(['','event:title','event:duration']);
});

it('the guide opens a requested chapter and navigates through the contents',async () => {
  await mount(<GuideView initialChapter={4}/>);
  expect(root.querySelector('[aria-current="page"]').textContent).toBe('Выбрать период и события');
  await click('.user-guide nav button');
  expect(root.querySelector('.user-guide-article h2').textContent).toBe('Создать событие');
  await click('.guide-chapter-navigation [data-next]');
  expect(root.querySelector('.user-guide-article h2').textContent).toBe('Открыть и изменить карточку');
  expect(root.querySelector('.guide-mobile-contents select[aria-label="Тема"]').value).toBe('1');
});

it('the guide board exercise moves and archives a sample task and resets it',async () => {
  await mount(<GuideView/>);
  const press = (selector,text) => act(()=>[...root.querySelectorAll(selector)].find(button=>button.textContent===text).click());
  await press('.guide-chapter-button','Доска');
  await press('.guide-chapter-topics button','Перемещать и архивировать задачи');
  await click('.guide-keyword');
  await click('.task-lane-todo .action-menu-trigger');
  await press('.task-lane-todo [role="menuitem"]','Переместить в «Готово»');
  await press('.task-lane-done button','Архивировать выполненные');
  await press('.task-board-bar button','Архив · 1');
  expect(root.querySelector('.task-archive').textContent).toContain('Проверить макет');
  await press('.guide-example > header button','Сначала');
  expect(root.querySelector('.task-lane-todo').textContent).toContain('Проверить макет');
});

it('guide keywords expand a journal example with reversible sample actions',async () => {
  await mount(<GuideView initialChapter={3}/>);
  const byText=text=>[...root.querySelectorAll('button')].find(button=>button.textContent===text);
  const press=button=>act(()=>button.click());
  const keyword=byText('«Ждут подтверждения»');
  await press(keyword);
  expect(keyword.getAttribute('aria-expanded')).toBe('true');
  const panel=document.getElementById(keyword.getAttribute('aria-controls'));
  await click('.guide-pick-card');
  await press(byText('Проведено'));
  expect(panel.textContent).toContain('Архив');
  expect(panel.querySelector('[data-event-state]').dataset.eventState).toBe('confirmed');
  await press(byText('Сначала'));
  await click('.guide-pick-card');
  await press(byText('Отменено'));
  expect(panel.querySelector('[data-event-state]').dataset.eventState).toBe('cancelled');
  await press(byText('Отложить выбор даты'));
  expect(panel.hidden).toBe(true);
  await press(byText('«Отложить перенос»'));
  await click('.guide-pick-card');
  await press(byText('Отложить перенос'));
  expect(root.querySelector('.guide-example-slots').textContent).toContain('Ждут новой даты');
  await click('.guide-pick-card');
  await press(byText('Вернуть на место'));
  expect(root.querySelector('.guide-example-slots').textContent).toContain('Очередь пуста');
});

it('guide separates switching a record from sharing its contact across events',async () => {
  await mount(<GuideView/>);
  const byText=(selector,text)=>[...root.querySelectorAll(selector)].find(element=>element.textContent===text);
  const press=element=>act(()=>element.click());
  await press(byText('.guide-chapter-topics button','Связать событие с записью'));
  await press(byText('.guide-keyword','«Связанная запись»'));
  const eventContacts=()=>[...root.querySelectorAll('.guide-object-event .guide-contact-value > span')].map(item=>item.textContent);
  expect(eventContacts()).toEqual(['anna@example.com']);
  await press(root.querySelector('input[value="ivan"]'));
  expect(eventContacts()).toEqual(['ivan@example.com']);
  expect(root.querySelector('.guide-object-event').textContent).toContain('Иван');
  await press(byText('.guide-chapter-button','Записи'));
  await press(byText('.guide-chapter-topics button','Использовать запись в нескольких событиях'));
  await press(byText('.guide-keyword','«Источник значения»'));
  expect(eventContacts()).toEqual(['anna@example.com','anna@example.com']);
  const sharedContact=root.querySelector('.guide-object input');
  await act(()=>{sharedContact.value='shared@example.com';sharedContact.dispatchEvent(new Event('input',{bubbles:true}));});
  expect(eventContacts()).toEqual(['shared@example.com','shared@example.com']);
});

it('guide switches between a linked contact and manual entry',async () => {
  await mount(<GuideView initialChapter={2}/>);
  const byText=(selector,text)=>[...root.querySelectorAll(selector)].find(element=>element.textContent===text);
  const press=element=>act(()=>element.click());
  await press(byText('.guide-chapter-topics button','Брать значение из записи'));
  await press(byText('.guide-keyword','«Источник значения»'));
  const input=root.querySelector('.guide-object input');
  await act(()=>{input.value='new@example.com';input.dispatchEvent(new Event('input',{bubbles:true}));});
  expect(root.querySelector('.guide-object-event').textContent).toContain('new@example.com');
  await press(root.querySelector('input[type="radio"][value="event"]'));
  expect(root.querySelector('.guide-object-event input').value).toBe('');
  await press(root.querySelector('input[type="radio"][value="record"]'));
  expect(root.querySelector('.guide-object-event').textContent).toContain('new@example.com');
});

it('guide transfers by dragging the card or by selecting a free slot',async () => {
  await mount(<GuideView/>);
  const topic=[...root.querySelectorAll('.guide-chapter-topics button')].find(button=>button.textContent==='Перенести одну встречу');
  await act(()=>topic.click());
  await click('.guide-keyword');
  const [tuesday,wednesday]=root.querySelectorAll('[data-transfer-date]');
  wednesday.getBoundingClientRect=()=>({left:150,right:300,top:0,bottom:100});
  const card=tuesday.querySelector('.guide-drag-card');
  card.setPointerCapture=()=>{};
  card.hasPointerCapture=()=>false;
  const pointer=(type,x)=>new PointerEvent(type,{bubbles:true,pointerId:1,isPrimary:true,clientX:x,clientY:30,button:0});
  await act(()=>{card.dispatchEvent(pointer('pointerdown',50));card.dispatchEvent(pointer('pointermove',180));});
  expect(wednesday.hasAttribute('data-drop-target')).toBe(true);
  await act(()=>card.dispatchEvent(pointer('pointerup',180)));
  expect(wednesday.querySelector('.guide-drag-card')).toBeTruthy();
  expect(tuesday.querySelector('.guide-drop-slot').disabled).toBe(true);
  await click('.guide-drag-card');
  await click('.guide-drop-slot');
  expect(tuesday.querySelector('.guide-drag-card')).toBeTruthy();
  expect(root.querySelector('.guide-demo-status').textContent).toContain('вернулось');
});
