import { render } from 'preact';
import { act } from 'preact/test-utils';
import { useState } from 'preact/hooks';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { ActionMenu } from '../src/components/ActionMenu.jsx';
import { EventDetails } from '../src/components/EventDetails.jsx';
import { TypeEditor } from '../src/components/TypeEditor.jsx';
import { RecordsDirectory } from '../src/components/RecordsDirectory.jsx';
import { RecordFields } from '../src/components/RecordFields.jsx';
import { TemplateWorkspace } from '../src/components/TemplateWorkspace.jsx';
import { App } from '../src/App.jsx';
import { defaultTypes, moveEvent } from '../src/lib/events.js';
import { todayISO } from '../src/lib/domain.js';
let root;
const mount = component => act(() => render(component,root));
const click = node => act(() => node.click());
const input = (node,value) => act(() => { node.value=value; node.dispatchEvent(new Event('input',{bubbles:true})); });
beforeEach(() => { localStorage.clear(); root=document.createElement('div'); document.body.append(root); HTMLDialogElement.prototype.showModal=function(){this.open=true;};HTMLDialogElement.prototype.close=function(){this.open=false;}; });
afterEach(async () => { await mount(null);root.remove();vi.restoreAllMocks(); });
it.each(['header', 'directory'])('creates and persists a project from the %s add-record button', async source => {
 localStorage.setItem('tutor-schedule:mode','personal');
 localStorage.setItem('tutor-schedule:personal:v2',JSON.stringify({version:2,students:[],records:[],series:[],events:[],types:defaultTypes(),recordTypes:[{kind:'project',fields:[]}]}));
 await mount(<App/>);
 await click(root.querySelector('.sidebar-toggle'));
 await click([...root.querySelectorAll('.nav-item')].find(node=>node.textContent.includes('Записи')));
 expect(root.querySelector('.layout').dataset.workspaceView).toBe('students');
 expect(root.querySelector('.page-header h1').classList.contains('sr-only')).toBe(true);
 expect(root.querySelector('.directory-toolbar h2')).toBeNull();
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
it('opens a pointer-activated menu without highlighting the first command', async () => {
 await mount(<ActionMenu items={[{id:'move',label:'Перенести',onSelect:vi.fn()},{id:'delete',label:'Удалить',onSelect:vi.fn()}]}/>);
 const trigger=root.querySelector('.action-menu-trigger');
 await act(()=>trigger.dispatchEvent(new MouseEvent('click',{detail:1,bubbles:true})));
 const menu=root.querySelector('[role="menu"]');
 expect(document.activeElement).toBe(menu);
 await act(()=>menu.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowUp',bubbles:true,cancelable:true})));
 expect(document.activeElement.textContent).toBe('Удалить');
});
it('shows the shared state and offers status changes through actions', async () => {
 const onStatus=vi.fn(); const data={students:[],records:[],types:defaultTypes(),events:[],series:[]};
 await mount(<EventDetails data={data} event={{id:'e',title:'Встреча',typeId:'personal',date:todayISO(),start:600,duration:60,status:'planned',fields:{}}} now={Date.parse(todayISO()+'T08:00:00+03:00')} onStatus={onStatus} onClose={()=>{}} onEdit={()=>{}} onMove={()=>{}} onDelete={vi.fn()}/>);
 expect(root.querySelector('.lesson-secondary-actions')).toBeNull();
 expect(root.querySelector('.activity-status').textContent).toBe('Запланировано');
 await click(root.querySelector('.action-menu-trigger'));
 await click([...root.querySelectorAll('[role="menuitem"]')].find(item=>item.textContent==='Отметить проведённым'));
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
it.each([false,true])('restores a waiting event to its original slot, respecting a conflict (%s)', async conflict => {
 const date=todayISO();
 const original={id:'waiting',title:'Занятие',typeId:'personal',date,anchorDate:date,start:600,duration:60,status:'planned',fields:{},busy:true,history:[]};
 const waiting=moveEvent(original,null,630,60);
 const events=[waiting,...(conflict?[{...original,id:'occupied',title:'Другая встреча'}]:[])];
 const data={version:2,revision:0,students:[],records:[],types:defaultTypes(),series:[],events,reminders:[{id:'reminder-one',eventId:'waiting',at:new Date(Date.now()+86400000).toISOString()}]};
 localStorage.setItem('tutor-schedule:mode','personal');localStorage.setItem('tutor-schedule:personal:v2',JSON.stringify(data));
 await mount(<App/>);
 await click(root.querySelector('[data-event-id="waiting"] .pending-open'));
 expect(root.querySelector('.event-reminder')).toBeNull();
 expect(root.querySelector('.pending-original-time').textContent).toContain('10:00');
 await click([...root.querySelectorAll('.inspector-footer button')].find(node=>node.textContent==='Вернуть на место'));
 const saved=JSON.parse(localStorage.getItem('tutor-schedule:personal:v2'));
 const event=saved.events.find(item=>item.id==='waiting');
 if(conflict) {
  expect(event.status).toBe('pending');expect(root.querySelector('.event-inspector')).toBeTruthy();
  expect(root.querySelector('#notice').textContent).toMatch(/пересечен/i);
 } else {
  expect(event).toMatchObject({date,start:600,status:'planned'});
  expect(event.history).toHaveLength(2);expect(saved.reminders).toHaveLength(0);
  expect(root.querySelector('.event-inspector')).toBeNull();
  await click(root.querySelector('.toast-undo'));
  const undone=JSON.parse(localStorage.getItem('tutor-schedule:personal:v2'));
  expect(undone.events.find(item=>item.id==='waiting').status).toBe('pending');expect(undone.reminders).toHaveLength(1);
 }
});

it('uses declared record-type sources and locks the inherited event field format', async () => {
 const workspace={students:[{id:'a',name:'Анна',details:[{id:'private',label:'Личная ссылка',type:'url'}]}],records:[],series:[],events:[],types:defaultTypes(),
   recordTypes:[{kind:'student',fields:[{id:'board',label:'Доска',type:'url'}]}]};
 const original=workspace.types[0];
 const save=vi.fn();
 await mount(<TypeEditor data={workspace} original={original} onSave={save} onClose={()=>{}}/>);
 const select=(label)=>[...root.querySelectorAll('label')].find(node=>node.firstElementChild?.textContent===label)?.querySelector('select');
 expect([...select('Шаблон связанной записи').options].map(option=>option.value)).not.toContain('any');
 expect([...select('Формат').options].map(option=>option.value)).not.toContain('date');
 const source=select('Источник значения');
 expect([...source.options].map(option=>option.value)).toContain('detail:board');
 expect([...source.options].map(option=>option.value)).not.toContain('detail:private');
 await act(()=>{source.value='detail:board';source.dispatchEvent(new Event('change',{bubbles:true}));});
 const format=root.querySelector('.builder-field[open] .builder-format-fixed');
 expect(format.textContent).toContain('Ссылка');
 expect(format.textContent).toContain('наследуется');
 expect(format.querySelector('select')).toBeNull();
 await act(()=>root.querySelector('form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
 expect(save.mock.calls[0][0].types[0].fields[0]).toMatchObject({label:'Тема',type:'url',source:{fieldId:'detail:board'}});
});

it('locks populated lesson fields and keeps empty ones editable', async () => {
 const workspace={students:[],records:[],series:[],events:[{typeId:'lesson',fields:{topic:'',rate:0}}],types:defaultTypes()};
 await mount(<TypeEditor data={workspace} original={workspace.types[0]} onSave={()=>{}} onClose={()=>{}}/>);
 const rows=[...root.querySelectorAll('.builder-field-row')];
 expect(rows[0].querySelector('.form-row select')).not.toBeNull();
 expect(rows[1].querySelector('.builder-format-fixed').textContent).toContain('сохранённых событиях');
});

it('opens mobile template lists before showing the selected editor', async () => {
 const data={students:[],records:[],events:[],series:[],types:defaultTypes(),recordTypes:[{kind:'student',fields:[]}]};
 await mount(<TemplateWorkspace data={data} mobile/>);
 expect(root.querySelector('.template-workspace-editor')).toBeNull();
 await click(root.querySelector('.template-list-select'));
 expect(root.querySelector('.template-browser-list')).toBeNull();
 expect(root.querySelector('.template-inline-editor')).not.toBeNull();
 await click(root.querySelector('.template-back'));
 await click(root.querySelector('.template-family-switch button:last-child'));
 expect(root.querySelector('.template-list-select').textContent).toBe('Ученик');
 expect(root.querySelector('.template-workspace-editor')).toBeNull();
 await click(root.querySelector('.template-create'));
 expect(root.querySelector('.template-workspace-editor .template-draft-row input')).not.toBeNull();
});

it('opens record templates in the shared template editor and saves a choice field', async () => {
 localStorage.setItem('tutor-schedule:mode','personal');
 await mount(<App/>);
 await click(root.querySelector('.sidebar-toggle'));
 await click([...root.querySelectorAll('.nav-item')].find(node=>node.textContent.includes('Редактор шаблонов')));
 await click(root.querySelector('.template-family-switch button:last-child'));
 expect([...root.querySelectorAll('.template-list-select')].map(button=>button.textContent)).toEqual(['Ученик']);
 expect(root.querySelector('.builder-fields').textContent).toContain('Telegram ученика');
 await click(root.querySelector('.template-create'));
 expect([...root.querySelectorAll('.record-template-fields dt')].map(item=>item.textContent)).toEqual(['Имя или название']);
 await input(root.querySelector('.template-draft-row input'),'Группа');
 await click(root.querySelector('.template-inline-editor .builder-heading button'));
 const field=root.querySelector('.template-inline-editor .builder-field[open]');
 expect(field).not.toBeNull();
 await click(field.querySelector('summary'));
 expect(field.open).toBe(false);
 await click(field.querySelector('summary'));
 expect(field.open).toBe(true);
 await input(field.querySelector('input'),'Уровень');
 const format=field.querySelector('select');
 expect([...format.options].map(option=>option.value)).toContain('url');
 await act(()=>{format.value='select';format.dispatchEvent(new Event('change',{bubbles:true}));});
 await click(root.querySelector('.template-inline-editor .option-editor > button'));
 await input(root.querySelector('.template-inline-editor .option-row input'),'Средний');
 await click(root.querySelector('.template-inline-editor .builder-heading button'));
 await input(root.querySelector('.builder-field[open] .form-row input'),'Телемост');
 const list=root.querySelector('.builder-fields');
 const [first,second]=list.children;
 const grip=first.querySelector('.builder-field-grip');
 list.getBoundingClientRect=()=>({top:0,bottom:96});
 first.getBoundingClientRect=()=>({top:0,bottom:48,height:48});
 second.getBoundingClientRect=()=>({top:48,bottom:96,height:48});
 grip.setPointerCapture=vi.fn();
 const pointer=(type,clientY)=>act(()=>grip.dispatchEvent(new PointerEvent(type,{bubbles:true,pointerId:1,isPrimary:true,clientY})));
 await pointer('pointerdown',24);
 await pointer('pointermove',76);
 expect(first.style.getPropertyValue('--field-reorder-y')).toBe('52px');
 expect(second.style.getPropertyValue('--field-reorder-y')).toBe('-48px');
 await pointer('pointerup',76);
 expect(list.hasAttribute('data-field-reordering')).toBe(false);
 await click(root.querySelector('.template-inline-editor button[type="submit"]'));
 expect(root.querySelector('.template-list-select[aria-pressed="true"]').textContent).toBe('Группа');
 expect([...root.querySelectorAll('.record-template-fields dt')].map(item=>item.textContent)).toEqual(['Имя или название']);
 const summaries=[...root.querySelectorAll('.template-inline-editor .builder-field summary')];
 expect(summaries[0].textContent).toContain('Телемост');
 expect(summaries[1].textContent).toContain('Средний');
});

it('saves a new event template with its field definitions and appearance in one draft', async () => {
 localStorage.setItem('tutor-schedule:mode','personal');
 await mount(<App/>);
 await click(root.querySelector('.sidebar-toggle'));
 await click([...root.querySelectorAll('.nav-item')].find(node=>node.textContent.includes('Редактор шаблонов')));
 await click(root.querySelector('.template-create'));
 await input(root.querySelector('.template-draft-row input'),'Семинар');
 expect(root.querySelector('.builder-heading')).toBeNull();
 const recordTemplate=root.querySelector('.builder-settings select');
 await act(()=>{recordTemplate.value='student';recordTemplate.dispatchEvent(new Event('change',{bubbles:true}));});
 await click(root.querySelector('.template-inline-editor .builder-heading button'));
 await input(root.querySelector('.builder-field[open] input'),'Материалы');
 await click(root.querySelector('.template-editor-tabs button:last-child'));
 expect(root.querySelector('.card-style-field').textContent).toContain('Материалы');
 await input(root.querySelector('.card-style-tint input'),'#224488');
 await click(root.querySelector('.template-editor-tabs button:first-child'));
 expect(root.querySelector('.builder-field[open] input').value).toBe('Материалы');
 await click(root.querySelector('.template-inline-editor button[type="submit"]'));
 const workspace=JSON.parse(localStorage.getItem('tutor-schedule:personal:v2'));
 expect(workspace.types.find(type=>type.name==='Семинар')).toMatchObject({recordKind:'student',cardStyle:{tint:'#224488'},fields:[{label:'Материалы'}]});
});

it('combines record search, template and active repetition filters', async () => {
 const workspace={students:[{id:'a',name:'Артём',contact:'+7 (999) 111-22-33'}],
   records:[{id:'p',kind:'project',name:'Артем и команда',details:[{label:'Предмет',value:'Математика'}]}],
   series:[{studentId:'a',until:'2026-11-20'}]};
 function Harness(){
   const [query,setQuery]=useState(''),[filter,setFilter]=useState('');
   return <RecordsDirectory data={workspace} today="2026-11-08" query={query} onQuery={setQuery} filter={filter} onFilter={setFilter}/>;
 }
 await mount(<Harness/>);
 const search=root.querySelector('input[type="search"]');
 const [template,repeats]=root.querySelectorAll('.record-filter-toolbar select');
 const choose=(select,value)=>act(()=>{select.value=value;select.dispatchEvent(new Event('change',{bubbles:true}));});
 await input(search,'артем математика');
 expect(root.querySelectorAll('.record-list-row')).toHaveLength(1);
 expect(root.querySelector('.record-list-row').textContent).toContain('Артем и команда');
 await choose(template,'student');
 expect(root.querySelectorAll('.record-list-row')).toHaveLength(0);
 await input(search,'7999111');
 await choose(repeats,'scheduled');
 expect(root.querySelector('.record-list-row').textContent).toContain('Артём');
 await click(root.querySelector('.record-filter-results button'));
 expect(root.querySelectorAll('.record-list-row')).toHaveLength(2);
});

it('deletes an unused record template from its menu', async () => {
 const workspace={version:2,students:[],records:[],series:[],events:[],types:defaultTypes(),recordTypes:[{kind:'project',fields:[]}]};
 localStorage.setItem('tutor-schedule:mode','personal');
 localStorage.setItem('tutor-schedule:personal:v2',JSON.stringify(workspace));
 await mount(<App/>);
 await click(root.querySelector('.sidebar-toggle'));
 await click([...root.querySelectorAll('.nav-item')].find(node=>node.textContent.includes('Редактор шаблонов')));
 await click(root.querySelector('.template-family-switch button:last-child'));
 const menu=root.querySelector('[aria-label="Другие действия с шаблоном «Проект»"]').closest('details');
 await click(menu.querySelector('summary'));
 await click([...menu.querySelectorAll('button')].find(button=>button.textContent==='В архив'));
 expect(root.querySelector('.template-list-select')).not.toBeNull();
 expect(root.querySelector('[aria-label="Другие действия с шаблоном «Проект»"]')).toBeNull();
 const archivedMenu=root.querySelector('[aria-label="Действия с архивным шаблоном «Проект»"]').closest('details');
 await click(root.querySelector('.template-archive-list > summary'));
 await click(archivedMenu.querySelector('summary'));
 await click([...archivedMenu.querySelectorAll('button')].find(button=>button.textContent==='Вернуть из архива'));
 const restoredMenu=root.querySelector('[aria-label="Другие действия с шаблоном «Проект»"]').closest('details');
 await click(restoredMenu.querySelector('summary'));
 await click([...restoredMenu.querySelectorAll('button')].find(button=>button.textContent==='Удалить шаблон'));
 expect(root.querySelector('.delete-modal h2').textContent).toBe('Удалить шаблон записи?');
 await act(()=>root.querySelector('.delete-modal form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
 expect(root.querySelector('[aria-label="Другие действия с шаблоном «Проект»"]')).toBeNull();
});
