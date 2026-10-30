import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { App } from '../src/App.jsx';
import { EventCard } from '../src/components/EventCard.jsx';
import { EventEditor } from '../src/components/EventEditor.jsx';
import { TypeEditor } from '../src/components/TypeEditor.jsx';
import { StudentEditor } from '../src/components/StudentEditor.jsx';
import { HistoryView } from '../src/components/HistoryView.jsx';
import { LinkedText } from '../src/components/LinkedValue.jsx';
import { defaultTypes, projectWeek } from '../src/lib/events.js';
import { addDays, todayISO, weekdayOf } from '../src/lib/domain.js';
vi.mock('../src/lib/firebase-client.js', () => ({ connectFirebase: vi.fn(async () => ({ onAuth: callback => { callback(null); return () => {}; } })), explainFirebaseError: error => error.message }));
let root;
const now=Date.parse('2026-10-30T12:00:00+03:00');
const base=()=>({version:2,revision:0,students:[],records:[{id:'course',kind:'course',name:'Математика',color:'blue',details:[{id:'board',label:'Доска',type:'url',value:'https://board.example.com/course'}]}],types:defaultTypes(),series:[],events:[]});
const event=()=>({id:'e',typeId:'class',recordId:'course',title:'Занятие',date:'2026-10-30',anchorDate:'2026-10-30',start:600,duration:60,status:'planned',fields:{call:'https://telemost.yandex.ru/j/123'},history:[]});
const mount=async element=>act(()=>render(element,root));
const click=async text=>{const button=[...root.querySelectorAll('button')].find(item=>item.textContent.includes(text));expect(button).toBeTruthy();await act(()=>button.click());};
const input=async(element,value,type='input')=>act(()=>{element.value=value;element.dispatchEvent(new Event(type,{bubbles:true}));});
const submit=async()=>act(()=>root.querySelector('form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
beforeEach(()=>{localStorage.clear();root=document.createElement('div');document.body.append(root);HTMLDialogElement.prototype.showModal=function(){this.open=true;};HTMLDialogElement.prototype.close=function(){this.open=false;};});
afterEach(async()=>{await act(()=>render(null,root));root.remove();vi.restoreAllMocks();});
it('compact card opens meeting and record board links separately from its main button',async()=>{
 const data=base();data.types[1].fields.push({id:'call',label:'Телемост',type:'url',showOnCard:true,showCompact:true});const open=vi.fn();
 await mount(<EventCard data={data} event={event()} expanded={false} now={now} onOpen={open}/>);
 const links=[...root.querySelectorAll('a')];expect(links.map(a=>a.textContent)).toEqual(['Телемост','Доска']);
 expect(links.every(a=>a.target==='_blank'&&a.rel.includes('noopener')&&!a.closest('button'))).toBe(true);
 links[0].addEventListener('click',e=>e.preventDefault());await act(()=>links[0].click());expect(open).not.toHaveBeenCalled();
 expect(root.textContent).toContain('Время прошло');expect(root.textContent).not.toContain('Проведено');
});
it('hidden event fields and hidden record links stay hidden in compact cards',async()=>{
 const data=base();data.types[1].fields.push({id:'call',label:'Телемост',type:'url',showOnCard:false,showCompact:false});data.records[0].details[0].showOnCard=false;
 await mount(<EventCard data={data} event={event()} expanded={false} now={now} onOpen={()=>{}}/>);
 expect(root.querySelectorAll('a')).toHaveLength(0);
});
it('named text hyperlinks remain text-safe and reject executable protocols',async()=>{
 await mount(<LinkedText value={'[Доска](https://board.example.com) <img src=x onerror=alert(1)> [Нет](javascript:alert(1))'}/>);
 expect(root.querySelectorAll('a')).toHaveLength(1);expect(root.querySelector('a').textContent).toBe('Доска');expect(root.querySelector('img')).toBeNull();expect(root.textContent).toContain('javascript:alert(1)');
});
it('URL format in the constructor defaults to showing the link in compact cards',async()=>{
 const data=base();const save=vi.fn();await mount(<TypeEditor data={data} original={data.types[2]} onSave={save} onClose={()=>{}}/>);
 await click('Добавить поле');const section=root.querySelector('.builder-field:last-child');
 await input(section.querySelector('input[type=text]'),'Телемост');await input(section.querySelector('select'),'url','change');
 const compact=[...section.querySelectorAll('label')].find(label=>label.textContent.includes('В свёрнутой карточке')).querySelector('input');expect(compact.checked).toBe(true);
 await submit();expect(save).toHaveBeenCalled();expect(save.mock.calls[0][0].types[2].fields.at(-1)).toMatchObject({type:'url',showCompact:true});
});
it('event URL editor rejects unsafe schemes and saves a valid meeting URL',async()=>{
 const data=base();data.types[1].fields.push({id:'call',label:'Телемост',type:'url'});const save=vi.fn();
 await mount(<EventEditor data={data} original={event()} onSave={save} onClose={()=>{}}/>);
 const url=root.querySelector('input[type=url]');await input(url,'javascript:alert(1)');await submit();expect(save).not.toHaveBeenCalled();expect(root.textContent).toContain('нужна ссылка');
 await input(url,'https://telemost.yandex.ru/j/456');await submit();expect(save.mock.calls[0][0].events[0].fields.call).toBe('https://telemost.yandex.ru/j/456');
});
it('student records can retain a reusable board link as a custom detail',async()=>{
 const data=base(),save=vi.fn();const student={id:'student',name:'Ученик',subject:'Математика',rate:1000,color:'violet',details:[{id:'board',label:'Доска',type:'url',value:'https://board.example.com/student',showOnCard:true}]};
 await mount(<StudentEditor data={data} original={student} onSave={save} onClose={()=>{}}/>);await submit();
 expect(save.mock.calls[0][0].students[0].details[0].value).toBe('https://board.example.com/student');
});
it('history filters confirmed meetings and opens the actual historical occurrence',async()=>{
 const data=base();data.events=[event(),{...event(),id:'done',date:'2026-10-29',status:'done',title:'Проведённое'}];const open=vi.fn();
 await mount(<HistoryView data={data} now={now} onOpen={open} onStatus={()=>{}}/>);
 await input(root.querySelector('select'),'done','change');expect(root.textContent).toContain('Проведённое');expect(root.querySelectorAll('.event-card')).toHaveLength(1);
 await act(()=>root.querySelector('.card-open').click());expect(open.mock.calls[0][0].id).toBe('done');
});
it('app ends repeats without losing earlier meetings after reopening storage',async()=>{
 const data=base(),today=todayISO();data.series=[{id:'weekly',typeId:'class',recordId:'course',title:'Повтор',from:addDays(today,-14),until:'',weekday:weekdayOf(today),start:0,duration:5,intervalWeeks:1,fields:{}}];
 localStorage.setItem('tutor-schedule:mode','personal');localStorage.setItem('tutor-schedule:personal:v2',JSON.stringify(data));
 await mount(<App/>);await act(()=>root.querySelector('.card-open').click());await click('Завершить повторы с сохранением истории');await submit();
 const saved=JSON.parse(localStorage.getItem('tutor-schedule:personal:v2'));expect(saved.series[0].until).toBe(addDays(today,-1));expect(projectWeek(saved,addDays(today,7),7).events).toHaveLength(0);
 expect(projectWeek(saved,addDays(today,-14),7).events).toHaveLength(1);expect(saved.series[0].snapshot.record.name).toBe('Математика');
 await click('История');expect(root.textContent).toContain('Прошедшее время не означает');
});
it('past-day badges and unconfirmed-time markers appear without automatic completion',async()=>{
 const data=base();const yesterday=addDays(todayISO(),-1);data.events=[{...event(),date:yesterday,anchorDate:yesterday}];localStorage.setItem('tutor-schedule:personal:v2',JSON.stringify(data));localStorage.setItem('tutor-schedule:mode','personal');
 await mount(<App/>);expect(root.querySelectorAll('.past-day-tag').length).toBeGreaterThan(0);
 const saved=JSON.parse(localStorage.getItem('tutor-schedule:personal:v2'));expect(saved.events[0].status).toBe('planned');
});

it('event-specific board link overrides the common board link with the same label',async()=>{
 const data=base();data.types[1].fields.push({id:'board',label:'Доска',type:'url',showOnCard:true,showCompact:true});
 await mount(<EventCard data={data} event={{...event(),fields:{board:'https://board.example.com/one-lesson'}}} expanded={false} now={now} onOpen={()=>{}}/>);
 expect(root.querySelectorAll('a')).toHaveLength(1);expect(root.querySelector('a').href).toBe('https://board.example.com/one-lesson');
});
