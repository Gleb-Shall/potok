import { render } from 'preact';
import { act } from 'preact/test-utils';
import { useState } from 'preact/hooks';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { ActionMenu } from '../src/components/ActionMenu.jsx';
import { EventDetails } from '../src/components/EventDetails.jsx';
import { RecordFields } from '../src/components/RecordFields.jsx';
import { App } from '../src/App.jsx';
import { defaultTypes } from '../src/lib/events.js';
import { todayISO } from '../src/lib/domain.js';
vi.mock('../src/lib/firebase-client.js', () => ({ connectFirebase:vi.fn(async () => ({onAuth:callback => {callback(null);return ()=>{};}})), getFirebaseSession:()=>undefined, explainFirebaseError:error=>error.message }));
let root;
const mount = component => act(() => render(component,root));
const click = node => act(() => node.click());
const input = (node,value) => act(() => { node.value=value; node.dispatchEvent(new Event('input',{bubbles:true})); });
beforeEach(() => { localStorage.clear(); root=document.createElement('div'); document.body.append(root); HTMLDialogElement.prototype.showModal=function(){this.open=true;};HTMLDialogElement.prototype.close=function(){this.open=false;}; });
afterEach(async () => { await mount(null);root.remove();vi.restoreAllMocks(); });
it.each(['header', 'directory'])('creates and persists a project from the %s add-record button', async source => {
 localStorage.setItem('tutor-schedule:mode','personal');
 await mount(<App/>);
 await click(root.querySelector('.sidebar-toggle'));
 await click([...root.querySelectorAll('.nav-item')].find(node=>node.textContent.includes('Записи')));
 const add=source==='header' ? root.querySelector('.header-actions .primary') :
   [...root.querySelectorAll('button')].find(node=>!node.closest('.page-header') && /Создать запись|Добавить запись/.test(node.textContent));
 expect(add).toBeTruthy(); await click(add);
 await click([...root.querySelectorAll('.record-choice button')].find(node=>node.textContent==='Проект'));
 const field=[...root.querySelectorAll('.field')].find(node=>node.firstElementChild.textContent==='Название или имя').querySelector('input');
 await input(field,'Поток');
 await act(()=>root.querySelector('.record-edit-form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
 expect(root.querySelector('.record-edit-form')).toBeNull();
 expect(JSON.parse(localStorage.getItem('tutor-schedule:personal:v2')).records).toEqual(expect.arrayContaining([expect.objectContaining({kind:'project',name:'Поток'})]));
 expect(root.textContent).toContain('Поток');
});
it('keeps menu commands keyboard accessible and returns focus without closing the surrounding panel', async () => {
 const remove=vi.fn();
 await mount(<ActionMenu items={[{id:'move',label:'Перенести',onSelect:vi.fn()},{id:'delete',label:'Удалить',danger:true,onSelect:remove}]}/>);
 const trigger=root.querySelector('.action-menu-trigger'); await click(trigger);
 expect(document.activeElement.textContent).toBe('Перенести');
 await act(() => document.activeElement.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true,cancelable:true})));
 expect(document.activeElement.textContent).toBe('Удалить');
 await act(() => document.activeElement.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true})));
 expect(document.activeElement).toBe(trigger); expect(trigger.getAttribute('aria-expanded')).toBe('false'); expect(remove).not.toHaveBeenCalled();
});
it('changes status as a property and keeps destructive commands inside the action menu', async () => {
 const onStatus=vi.fn(); const data={students:[],records:[],types:defaultTypes(),events:[],series:[]};
 await mount(<EventDetails data={data} event={{id:'e',title:'Встреча',typeId:'personal',date:todayISO(),start:600,duration:60,status:'planned',fields:{}}} onStatus={onStatus} onClose={()=>{}} onEdit={()=>{}} onMove={()=>{}} onDelete={vi.fn()}/>);
 expect(root.querySelector('.lesson-secondary-actions')).toBeNull();
 const status=root.querySelector('[aria-label="Статус события"]');
 await act(() => {status.value='done';status.dispatchEvent(new Event('change',{bubbles:true}));});
 expect(onStatus).toHaveBeenCalledWith('done');
 await click(root.querySelector('.action-menu-trigger'));
 expect(root.querySelector('.ui-action-menu[data-open=true]').textContent).toContain('Удалить событие');
});
it('defers from the card menu, exposes the waiting queue and supports undo', async () => {
 const date=todayISO();
 const data={version:2,students:[],records:[],series:[],types:defaultTypes(),events:[{id:'e',typeId:'personal',title:'Встреча',date,anchorDate:date,start:600,duration:60,status:'planned',fields:{},history:[]}]};
 localStorage.setItem('tutor-schedule:mode','personal');localStorage.setItem('tutor-schedule:personal:v2',JSON.stringify(data));
 localStorage.setItem('potok:week-layout','board');
 await mount(<App/>); await click(root.querySelector('.card-controls .action-menu-trigger'));
 await click([...root.querySelectorAll('.ui-action-menu[data-open=true] button')].find(node=>node.textContent.includes('Отложить перенос')));
 expect(root.querySelectorAll('.pending-card')).toHaveLength(1);expect(root.querySelector('.pending-shortcut').textContent).toContain('1');
 await click(root.querySelector('.toast-undo'));
 expect(root.querySelectorAll('.pending-card')).toHaveLength(0);expect(root.querySelector('.card-name').textContent).toBe('Встреча');
});
it('keeps a new record field expanded while typing and preserves it when another field is added', async () => {
 function Harness(){const [value,setValue]=useState([]);return <RecordFields value={value} onChange={setValue}/>;}
 await mount(<Harness/>);await click(root.querySelector('.builder-heading button'));
 await input(root.querySelector('.record-detail-editor input'),'Доска');
 expect(root.querySelector('.record-detail-editor').open).toBe(true);
 const values=root.querySelectorAll('.record-detail-editor input');await input(values[1],'https://example.com/board');
 await click(root.querySelector('.builder-heading button'));
 expect(root.querySelectorAll('.record-detail-editor[open]')).toHaveLength(1);
 expect(root.querySelector('.record-detail-editor input').value).toBe('Доска');
 expect(root.querySelectorAll('.record-detail-editor input')[1].value).toBe('https://example.com/board');
});
it('opens a reminder directly from the pending queue and saves it for that event', async () => {
 const data={version:2,revision:0,students:[],records:[],types:defaultTypes(),events:[{id:'pending-event',title:'Занятие с Анной',typeId:'personal',date:null,anchorDate:todayISO(),start:600,duration:60,status:'pending',fields:{}}],series:[]};
 localStorage.setItem('tutor-schedule:mode','personal');localStorage.setItem('tutor-schedule:personal:v2',JSON.stringify(data));
 localStorage.setItem('potok:week-layout','board');
 await mount(<App/>);
 const remind=[...root.querySelectorAll('.pending-card button')].find(button=>button.textContent==='Напомнить');
 expect(remind).toBeTruthy();await click(remind);
 expect(root.querySelector('[aria-label="Напоминание о событии"]')).not.toBeNull();
 expect(root.querySelector('.reminder-dialog')).not.toBeNull();expect(root.querySelector('[aria-label="Статус события"]')).toBeNull();
 expect(root.querySelector('.inspector-footer')).toBeNull();
 await act(async()=>[...root.querySelectorAll('button')].find(button=>button.textContent==='Завтра в 09:00').click());
 const saved=JSON.parse(localStorage.getItem('tutor-schedule:personal:v2'));
 expect(saved.reminders).toHaveLength(1);expect(saved.reminders[0].eventId).toBe('pending-event');
});
