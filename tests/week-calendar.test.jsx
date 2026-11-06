import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {render} from 'preact';
import {act} from 'preact/test-utils';
import {App} from '../src/App.jsx';
import {defaultTypes,moveEvent} from '../src/lib/events.js';
import {todayISO,addDays,mondayOf} from '../src/lib/domain.js';

vi.mock('../src/lib/firebase-client.js',()=>({connectFirebase:vi.fn(async()=>({onAuth:callback=>{callback(null);return()=>{};}})),getFirebaseSession:()=>undefined,explainFirebaseError:error=>error.message}));
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
it('moves in time on the same day, then restores the original slot and keeps the audit trail',async()=>{
 await mount();expect(root.querySelectorAll('[data-time-date]')).toHaveLength(7);
 await dragTo(todayISO(),735);
 let saved=JSON.parse(localStorage.getItem(key)).events[0];expect(saved.start).toBe(735);expect(saved.originalStart).toBe(600);expect(saved.history).toHaveLength(1);
 expect(root.querySelectorAll('.week-ghost')).toHaveLength(1);
 await dragTo(todayISO(),600);
 saved=JSON.parse(localStorage.getItem(key)).events[0];expect(saved.start).toBe(600);expect(root.querySelectorAll('.week-ghost')).toHaveLength(0);expect(saved.history.length).toBeGreaterThan(1);
});
it('supports an unchanged drop and opens the editor with the clicked time',async()=>{
 await mount();const revision=JSON.parse(localStorage.getItem(key)).revision;
 await dragTo(todayISO(),600);expect(JSON.parse(localStorage.getItem(key)).revision).toBe(revision);
 const next=addDays(mondayOf(todayISO()),1);const lane=root.querySelector(`[data-time-date="${next}"]`);
 lane.getBoundingClientRect=()=>({top:0,height:1824});
 await act(()=>lane.dispatchEvent(new MouseEvent('dblclick',{bubbles:true,clientY:1102})));
 expect(root.querySelector('dialog input[type=time]').value).toBe('14:30');
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
 expect(root.querySelector('.week-time-axis').lastElementChild.textContent).toBe('23:00');
 expect(root.querySelector('[data-event-id="early"]')).toBeTruthy();
 expect(root.querySelector('[data-event-id="late"]')).toBeTruthy();
});
