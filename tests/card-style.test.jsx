import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { CardStyleEditor } from '../src/components/CardStyleEditor.jsx';
import { EventCard } from '../src/components/EventCard.jsx';
import SelectedCardMotion from '../src/components/SelectedCardMotion.jsx';
import { defaultTypes } from '../src/lib/events.js';
import { cardComposition, readCardStyle } from '../src/lib/card-style.js';

let root;
beforeEach(() => {
  root=document.createElement('div');document.body.append(root);
  HTMLDialogElement.prototype.showModal=function(){this.open=true;};
  HTMLDialogElement.prototype.close=function(){this.open=false;};
});
afterEach(async()=>{await act(()=>render(null,root));root.remove();vi.restoreAllMocks();vi.unstubAllGlobals();});
const change=async(node,value)=>act(()=>{node.value=value;node.dispatchEvent(new Event('change',{bubbles:true}));});

it('edits layouts independently, preserving field definitions and the old link defaults',async()=>{
  const types=defaultTypes(), type=types[0];
  type.fields.push({id:'call',type:'url',label:'Телемост',required:false,options:[]});
  const data={types,students:[],records:[],events:[],series:[]};
  const save=vi.fn();
  await act(()=>render(<CardStyleEditor data={data} original={type} onSave={save} onClose={()=>{}}/>,root));
  const view=root.querySelector('.card-style-preview select');
  const slot=()=>root.querySelector('.card-style-field select');
  await change(slot(),'badge');
  expect(root.querySelector('.composition-badge').textContent).toBe('Производные');
  expect(root.querySelector('.card-record-links a').textContent).toBe('Телемост');
  await change(view,'board');
  expect(slot().value).toBe('hidden');
  await change(slot(),'line');
  await change(view,'grid');
  expect(slot().value).toBe('badge');
  await act(()=>root.querySelector('form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
  const saved=save.mock.calls[0][0].types.find(item=>item.id===type.id);
  expect(saved.fields).toEqual(type.fields);
  expect(saved.cardStyle.layouts.grid[0]).toEqual({id:'topic',slot:'badge'});
  expect(saved.cardStyle.layouts.board[0]).toEqual({id:'topic',slot:'line'});
  expect(cardComposition(saved,'expanded').find(row=>row.field.id==='call').slot).toBe('link');
});

it('drops invalid imported tint and layout entries before applying a style',()=>{
  const type={...defaultTypes()[0],cardStyle:{tint:'url(https://example.com)',opacity:500,layouts:{grid:[{id:'topic',slot:'link'},{id:'removed',slot:'badge'}]}}};
  expect(readCardStyle(type)).toMatchObject({tint:'',opacity:100,layouts:{grid:[{id:'topic',slot:'hidden'}]}});
});

it('reorders only the active layout after a completed field drag',async()=>{
  const types=defaultTypes(), save=vi.fn();
  const data={types,students:[],records:[],events:[],series:[]};
  await act(()=>render(<CardStyleEditor data={data} original={types[0]} onSave={save} onClose={()=>{}}/>,root));
  const list=root.querySelector('.card-style-fields');
  const [first, second]=list.children;
  const grip=first.querySelector('button');
  grip.setPointerCapture=vi.fn();
  list.getBoundingClientRect=()=>({top:0,bottom:96});
  first.getBoundingClientRect=()=>({bottom:48});
  second.getBoundingClientRect=()=>({bottom:96});
  const pointer=(type,clientY)=>act(()=>grip.dispatchEvent(new PointerEvent(type,{bubbles:true,pointerId:1,isPrimary:true,clientY})));
  await pointer('pointerdown',24);
  await pointer('pointermove',72);
  expect(second.dataset.drop).toBe('after');
  await pointer('pointercancel',72);
  expect(list.firstElementChild).toBe(first);
  expect(second.dataset.drop).toBeUndefined();
  await pointer('pointerdown',24);
  await pointer('pointermove',72);
  await pointer('pointerup',72);
  expect(list.firstElementChild).toBe(second);
  await act(()=>root.querySelector('form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
  const saved=save.mock.calls[0][0].types[0];
  expect(saved.cardStyle.layouts.grid.map(row=>row.id)).toEqual([...types[0].fields].reverse().map(field=>field.id));
  expect(saved.cardStyle.layouts.board).toBeUndefined();
});

it('runs selected-card motion only while active and clears frames on pause',async()=>{
  const queue=new Map();let next=0;
  vi.stubGlobal('requestAnimationFrame',callback=>{queue.set(++next,callback);return next;});
  vi.stubGlobal('cancelAnimationFrame',id=>queue.delete(id));
  vi.spyOn(document,'hidden','get').mockReturnValue(false);
  vi.stubGlobal('matchMedia',()=>({matches:false,addListener(){},removeListener(){}}));
  const drawing={clearRect:vi.fn(),setTransform:vi.fn(),fillText:vi.fn()};
  vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue(drawing);
  const card=document.createElement('div'), letter=document.createElement('span');
  letter.dataset.motionLetter='';card.append(letter);root.append(card);
  card.getBoundingClientRect=()=>({left:0,top:0,width:180,height:76});
  letter.getBoundingClientRect=()=>({left:70,top:22,width:7,height:14});
  const ref={current:card};
  const host=document.createElement('div');card.append(host);
  await act(()=>render(<SelectedCardMotion cardRef={ref} smoke liveText paused={false} title="А"/>,host));
  expect(queue.size).toBe(1);
  card.dispatchEvent(new MouseEvent('pointermove',{clientX:68,clientY:27}));
  const frames=[...queue.values()];queue.clear();
  frames.forEach(callback=>callback(performance.now()+40));
  expect(drawing.fillText).toHaveBeenCalled();
  expect(letter.style.transform).toContain('translate');
  await act(()=>render(<SelectedCardMotion cardRef={ref} smoke liveText paused title="А"/>,host));
  expect(queue.size).toBe(0);
  expect(letter.style.transform).toBe('');
  await act(()=>render(<SelectedCardMotion cardRef={ref} smoke liveText paused={false} title="А"/>,host));
  expect(queue.size).toBe(0); // Resuming a move/dialog does not replay the selection effect.
  await act(()=>render(null,host));
});

it('starts the selection plume when a previously hidden card becomes measurable',async()=>{
  const queue=new Map();
  let next=0, resize, width=0;
  const disconnect=vi.fn();
  vi.stubGlobal('requestAnimationFrame',callback=>{queue.set(++next,callback);return next;});
  vi.stubGlobal('cancelAnimationFrame',id=>queue.delete(id));
  vi.stubGlobal('ResizeObserver',class {
    constructor(callback){ resize=callback; }
    observe(){}
    disconnect(){ disconnect(); }
  });
  vi.spyOn(document,'hidden','get').mockReturnValue(false);
  vi.stubGlobal('matchMedia',()=>({matches:false,addListener(){},removeListener(){}}));
  const drawing={clearRect:vi.fn(),setTransform:vi.fn(),fillText:vi.fn()};
  vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue(drawing);
  root.getBoundingClientRect=()=>({left:0,top:0,width,height:76});
  const tick=()=>{const frames=[...queue.values()];queue.clear();frames.forEach(callback=>callback());};
  await act(()=>render(<SelectedCardMotion cardRef={{current:root}} smoke/>,root));
  tick();
  expect(queue.size).toBe(0);
  expect(drawing.fillText).not.toHaveBeenCalled();
  width=180;resize();tick();
  expect(drawing.fillText).toHaveBeenCalled();
  await act(()=>render(null,root));
  expect(queue.size).toBe(0);
  expect(disconnect).toHaveBeenCalledOnce();
});

it('leaves an unselected card without a canvas or split title',async()=>{
  const type=defaultTypes()[0],data={types:[type],students:[],records:[]};
  await act(()=>render(<EventCard data={data} preview event={{id:'a',typeId:type.id,title:'Урок',date:'2026-11-07',start:900,duration:60,status:'planned',fields:{}}}/>,root));
  expect(root.querySelector('canvas,[data-motion-letter]')).toBeNull();
});
