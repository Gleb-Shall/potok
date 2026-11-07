import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {render} from 'preact';
import {act} from 'preact/test-utils';
import {App} from '../src/App.jsx';
import {defaultTypes,moveEvent} from '../src/lib/events.js';
import {todayISO,addDays,mondayOf} from '../src/lib/domain.js';

const maps=vi.hoisted(()=>({created:0,destroyed:0}));
vi.mock('../src/components/MapCanvas.jsx',async()=>{
 const {useEffect}=await import('preact/hooks');
 return {MapCanvas:({location})=>{useEffect(()=>{maps.created++;return()=>maps.destroyed++;},[]);return <div data-test-map>{location.label}</div>;}};
});
let root;
const key='tutor-schedule:personal:v2';
const sample=()=>({version:2,revision:0,students:[],records:[],types:defaultTypes(),series:[],events:[{id:'one',typeId:'personal',title:'Встреча',date:todayISO(),anchorDate:todayISO(),start:600,duration:60,status:'planned',busy:true,fields:{},history:[],location:{lat:59.93,lng:30.31,label:'Исаакиевская площадь',address:'Санкт-Петербург'}}]});
const mount=async(data=sample())=>{localStorage.setItem('tutor-schedule:mode','personal');localStorage.setItem(key,JSON.stringify(data));await act(()=>render(<App/>,root));};
const click=async node=>{expect(node).toBeTruthy();await act(()=>node.click());};
const dragTo=async(date,minute)=>{
 const card=root.querySelector('[data-event-id="one"]');
 const transfer={setData:vi.fn(),setDragImage:vi.fn()};
 const start=new Event('dragstart',{bubbles:true,cancelable:true});Object.defineProperty(start,'dataTransfer',{value:transfer});
 await act(()=>card.dispatchEvent(start));
 const lane=root.querySelector(`[data-time-date="${date}"]`);
 lane.getBoundingClientRect=()=>({top:0,height:1824});
 const drop=new MouseEvent('drop',{bubbles:true,cancelable:true,clientY:minute/60*76});Object.defineProperty(drop,'dataTransfer',{value:transfer});
 await act(()=>lane.dispatchEvent(drop));
};
beforeEach(()=>{localStorage.clear();maps.created=maps.destroyed=0;root=document.createElement('div');document.body.append(root);HTMLDialogElement.prototype.showModal=function(){this.open=true;};HTMLDialogElement.prototype.close=function(){this.open=false;};});
afterEach(async()=>{await act(()=>render(null,root));root.remove();vi.restoreAllMocks();});
it('keeps a rolling week and returns to today through the selected view tab',async()=>{
 await mount();
 const tabs=root.querySelector('.calendar-topbar [aria-label="Период расписания"]');
 expect([...tabs.querySelectorAll('button')].map(node=>node.textContent)).toEqual(['День','Неделя','Месяц']);
 expect(root.querySelector('.calendar-topbar h1').className).toBe('sr-only');
 expect([...root.querySelectorAll('button')].some(node=>node.textContent==='Сегодня')).toBe(false);
 const dates=()=>[...root.querySelectorAll('[data-visible-date]')].map(node=>node.dataset.visibleDate);
 const scroller=root.querySelector('.week-scroller');
 Object.defineProperty(scroller,'clientWidth',{configurable:true,value:752});
 scroller.querySelector('.week-axis-heading').getBoundingClientRect=()=>({width:52});
 await click(tabs.querySelector('[aria-pressed=true]'));
 const pan=async delta=>{
   await act(()=>{scroller.scrollLeft+=delta;scroller.dispatchEvent(new Event('scroll'));scroller.dispatchEvent(new Event('scrollend'));});
 };
 const first=mondayOf(todayISO());
 await pan(100);
 expect(dates()).toEqual(Array.from({length:7},(_,i)=>addDays(first,i+1)));
 await pan(200); // A continued pan can move beyond the first day without a lock.
 expect(dates()[0]).toBe(addDays(first,3));
 await click(tabs.querySelector('[aria-pressed=true]'));
 expect(dates()[0]).toBe(first);
 await click(tabs.querySelector('button'));
 expect(dates()).toEqual([todayISO()]);
 await pan(-700);
 expect(dates()).toEqual([addDays(todayISO(),-1)]);
 await click(tabs.querySelector('[aria-pressed=true]'));
 expect(dates()).toEqual([todayISO()]);
});
it('shows the current time on the left axis only when today is in view',async()=>{
 vi.spyOn(Date,'now').mockReturnValue(new Date('2026-11-06T12:24:00Z').getTime());
 await mount();
 expect(root.querySelector('.week-now-time').textContent).toBe('15:24');
 expect(root.querySelector('.week-now-time').dateTime).toBe('2026-11-06T15:24:00+03:00');
 await click(root.querySelector('[aria-label="Предыдущий период"]'));
 expect(root.querySelector('.week-now-time')).toBeNull();
});
it('moves in time on the same day, then restores the original slot and keeps the audit trail',async()=>{
 await mount();expect(root.querySelectorAll('[data-visible-date]')).toHaveLength(7);
 await dragTo(todayISO(),735);
 let saved=JSON.parse(localStorage.getItem(key)).events[0];expect(saved.start).toBe(735);expect(saved.originalStart).toBe(600);expect(saved.history).toHaveLength(1);
 expect(root.querySelectorAll('.week-ghost')).toHaveLength(1);
 await dragTo(todayISO(),600);
 saved=JSON.parse(localStorage.getItem(key)).events[0];expect(saved.start).toBe(600);expect(root.querySelectorAll('.week-ghost')).toHaveLength(0);expect(saved.history.length).toBeGreaterThan(1);
});
it('keeps board selection available in both day and week views',async()=>{
 await mount();
 const tabs=root.querySelector('.calendar-topbar [aria-label="Период расписания"]');
 await click(tabs.querySelector('button'));
 const board=()=>[...root.querySelectorAll('.week-layout-switch button')].find(button=>button.textContent==='Доска');
 await click(board());expect(root.querySelector('.calendar-day')).toBeTruthy();expect(root.querySelector('.week-timeline')).toBeNull();
 await click([...root.querySelectorAll('.week-layout-switch button')].find(button=>button.textContent==='По времени'));
 expect(root.querySelector('.week-timeline.is-day-view')).toBeTruthy();
});
it('uses a time-slot preview for mouse movement and never falls back to a board header',async()=>{
 await mount();
 const mouse=(node,type,y)=>node.dispatchEvent(new MouseEvent(type,{bubbles:true,cancelable:true,button:0,buttons:type==='mouseup'?0:1,clientX:100,clientY:y}));
 let card=root.querySelector('[data-event-id="one"]');
 expect(card.draggable).toBe(false);
 card.getBoundingClientRect=()=>({top:100});
 const lane=root.querySelector(`[data-time-date="${todayISO()}"]`);lane.getBoundingClientRect=()=>({top:0,height:1824});
 Object.defineProperty(document,'elementFromPoint',{configurable:true,value:vi.fn(()=>lane)});
 const targetY=735/60*76+20;
 await act(()=>mouse(card.querySelector('.card-open'),'mousedown',120));
 await act(()=>mouse(document,'mousemove',targetY));
 expect(root.querySelector('.week-drop-slot').textContent).toContain('12:15');
 expect(document.querySelector('.press-drag-ghost')).toBeNull();
 await act(()=>mouse(document,'mouseup',targetY));
 expect(JSON.parse(localStorage.getItem(key)).events[0].start).toBe(735);
 const revision=JSON.parse(localStorage.getItem(key)).revision;
 card=root.querySelector('[data-event-id="one"]');card.getBoundingClientRect=()=>({top:100});
 document.elementFromPoint.mockReturnValue(root.querySelector('.week-day-heading'));
 await act(()=>{mouse(card.querySelector('.card-open'),'mousedown',120);mouse(document,'mousemove',200);});
 expect(root.querySelector('.week-drop-slot')).toBeNull();
 await act(()=>mouse(document,'mouseup',200));
 expect(JSON.parse(localStorage.getItem(key)).revision).toBe(revision);
});
it('supports an unchanged drop and opens the editor with the clicked time',async()=>{
 await mount();const revision=JSON.parse(localStorage.getItem(key)).revision;
 await dragTo(todayISO(),600);expect(JSON.parse(localStorage.getItem(key)).revision).toBe(revision);
 const next=addDays(mondayOf(todayISO()),1);const lane=root.querySelector(`[data-time-date="${next}"]`);
 lane.getBoundingClientRect=()=>({top:0,height:1824});
 await act(()=>lane.dispatchEvent(new MouseEvent('dblclick',{bubbles:true,clientY:1102})));
 expect(root.querySelector('dialog input[type=time]').value).toBe('14:30');
});
it('selects on click, resizes only the selected card and opens on double click',async()=>{
 const data=sample();data.types.find(type=>type.id==='personal').cardStyle={smoke:false,liveText:false};
 await mount(data);
 const card=()=>root.querySelector('[data-event-id="one"]');
 expect(root.querySelector('.week-resize-handle')).toBeNull();
 await act(()=>card().querySelector('.card-open').dispatchEvent(new MouseEvent('click',{bubbles:true,detail:1})));
 expect(card().classList.contains('is-card-selected')).toBe(true);
 expect(root.querySelector('dialog')).toBeNull();
 const pointer=(node,type,y)=>{const input=new MouseEvent(type,{bubbles:true,cancelable:true,button:0,clientY:y});Object.defineProperty(input,'pointerId',{value:1});node.dispatchEvent(input);};
 const handle=edge=>root.querySelector(`[data-event-id="one"]`).parentElement.querySelector(`.week-resize-handle.is-${edge}`);
 await act(()=>pointer(handle('end'),'pointerdown',100));
 await act(()=>pointer(document,'pointermove',157)); // 45 minutes at 76px/hour.
 await act(()=>new Promise(resolve=>setTimeout(resolve,25)));
 expect(root.querySelector('[data-event-id="one"] .card-time').textContent).toContain('10:00–11:45');
 expect(JSON.parse(localStorage.getItem(key)).events[0].duration).toBe(60);
 await act(()=>pointer(document,'pointerup',157));
 let saved=JSON.parse(localStorage.getItem(key)).events[0];expect(saved.start).toBe(600);expect(saved.duration).toBe(105);
 await act(()=>{pointer(handle('start'),'pointerdown',100);pointer(document,'pointerup',62);});
 saved=JSON.parse(localStorage.getItem(key)).events[0];expect(saved.start).toBe(570);expect(saved.duration).toBe(135);expect(saved.originalDuration).toBe(60);
 const revision=JSON.parse(localStorage.getItem(key)).revision;
 await act(()=>{pointer(handle('end'),'pointerdown',100);pointer(document,'pointermove',200);document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));});
 expect(JSON.parse(localStorage.getItem(key)).revision).toBe(revision);expect(root.querySelector('.week-event.is-resizing')).toBeNull();
 card().getBoundingClientRect=()=>({left:window.innerWidth-160,right:window.innerWidth-20,top:80,bottom:150});
 await act(()=>card().querySelector('.card-open').dispatchEvent(new MouseEvent('dblclick',{bubbles:true,detail:2})));
 const inspector=root.querySelector('.event-inspector.is-anchored');
 expect(inspector.querySelector('h2').textContent).toBe('Встреча');
 Object.defineProperties(inspector,{offsetWidth:{value:360},offsetHeight:{value:290}});
 window.dispatchEvent(new Event('resize'));
 expect(inspector.style.getPropertyValue('--dialog-x')).toBe(`${window.innerWidth-532}px`);
 expect(inspector.style.getPropertyValue('--dialog-y')).toBe('80px');
});
it('expands and contracts the event map without remounting it, and navigation closes on selection',async()=>{
 await mount();await click(root.querySelector('[data-event-id="one"] .card-open'));
 expect(maps.created).toBe(1);expect(root.querySelector('.event-place-map')).toBeTruthy();
 await click(root.querySelector('[aria-label="Раскрыть карту"]'));
 expect(root.querySelector('dialog').classList.contains('has-expanded-map')).toBe(true);expect(maps.created).toBe(1);
 await act(()=>root.querySelector('dialog').dispatchEvent(new Event('cancel',{bubbles:false,cancelable:true})));
 expect(root.querySelector('dialog').classList.contains('has-expanded-map')).toBe(false);expect(maps.destroyed).toBe(0);
 await click(root.querySelector('[aria-label="Закрыть окно"]'));expect(maps.destroyed).toBe(1);
 await click(root.querySelector('[aria-label="Открыть разделы"]'));
 expect(root.querySelector('.layout').classList.contains('sidebar-collapsed')).toBe(false);
 await click(root.querySelector('.sidebar [aria-label="Записи"]'));
 expect(root.querySelector('.layout').classList.contains('sidebar-collapsed')).toBe(true);
 expect(root.querySelector('h1').textContent).toBe('Записи');
});

it('rejects a conflicting time without losing the original event, then schedules a pending event',async()=>{
 const data=sample();data.events.push({...data.events[0],id:'occupied',title:'Занято',start:735});
 await mount(data);await dragTo(todayISO(),735);
 expect(JSON.parse(localStorage.getItem(key)).events.find(event=>event.id==='one').start).toBe(600);
 expect(root.textContent).toContain('Пересечение');
 await act(()=>render(null,root));
 const waiting=sample();waiting.events[0]=moveEvent(waiting.events[0],null,600,60);
 await mount(waiting);
 await click(root.querySelector('.pending-shortcut'));
 await dragTo(todayISO(),540);
 const saved=JSON.parse(localStorage.getItem(key)).events[0];expect(saved.status).toBe('planned');expect(saved.start).toBe(540);
 expect(root.querySelectorAll('.pending-card')).toHaveLength(0);
});

it('shows the full day including midnight and late events by default',async()=>{
 const data=sample();data.events=[{...data.events[0],id:'early',start:0,duration:30},{...data.events[0],id:'late',start:1410,duration:30}];
 await mount(data);
 const lane=root.querySelector(`[data-time-date="${todayISO()}"]`);
 expect(lane.dataset.timeStart).toBe('0');expect(lane.dataset.timeEnd).toBe('1440');
 expect(root.querySelector('.week-time-axis').firstElementChild.textContent).toBe('00:00');
 expect([...root.querySelectorAll('.week-time-axis > span')].at(-1).textContent).toBe('23:00');
 expect(root.querySelector('[data-event-id="early"]')).toBeTruthy();
 expect(root.querySelector('[data-event-id="late"]')).toBeTruthy();
});

it('opens the clicked event directly with its own expanded map from the place marker',async()=>{
 await mount();
 expect(maps.created).toBe(0);
 const card=root.querySelector('[data-event-id="one"]');
 const marker=card.querySelector('button.event-place-mark');
 expect(marker.closest('.card-open')).toBeNull();
 await click(marker);
 const inspector=document.body.querySelector('.event-inspector');
 expect(inspector.classList.contains('has-expanded-map')).toBe(true);
 expect(inspector.querySelector('h2').textContent).toBe('Встреча');
 expect(inspector.querySelector('[data-test-map]').textContent).toBe('Исаакиевская площадь');
 expect(document.body.querySelector('.map-events')).toBeNull();
 expect(maps.created).toBe(1);
});
