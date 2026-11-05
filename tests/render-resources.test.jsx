import { render } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, expect, it, vi } from 'vitest';
import { paintSurface } from '../src/components/landing/world/dom-surface.js';
import { EventCard } from '../src/components/EventCard.jsx';
import { defaultTypes } from '../src/lib/events.js';
let root;
afterEach(()=>{if(root){act(()=>render(null,root));root.remove();root=null;}vi.restoreAllMocks();vi.unstubAllGlobals();});

it('repaints in place and only reallocates a canvas buffer after a size change',()=>{
 root=document.createElement('div');document.body.append(root);
 let size={width:120,height:60};root.getBoundingClientRect=()=>size;
 const canvas=document.createElement('canvas');let width=300,height=150,widthWrites=0,heightWrites=0;
 Object.defineProperties(canvas,{width:{get:()=>width,set:value=>{width=value;widthWrites++;}},height:{get:()=>height,set:value=>{height=value;heightWrites++;}}});
 const ctx={globalAlpha:1,setTransform:vi.fn(),clearRect:vi.fn(),scale:vi.fn(),save:vi.fn(),restore:vi.fn(),beginPath:vi.fn(),roundRect:vi.fn(),fill:vi.fn(),clip:vi.fn()};
 vi.spyOn(canvas,'getContext').mockReturnValue(ctx);
 expect(paintSurface(root,canvas,2)).toBe(true);expect(paintSurface(root,canvas,2)).toBe(true);
 expect([widthWrites,heightWrites]).toEqual([1,1]);expect(ctx.clearRect).toHaveBeenCalledTimes(2);
 size={width:140,height:60};paintSurface(root,canvas,2);expect([widthWrites,heightWrites]).toEqual([2,1]);
});

it('releases drag-preview DOM and queued frames when a card unmounts before the next paint',async()=>{
 const frames=new Map();let next=0;
 vi.stubGlobal('requestAnimationFrame',callback=>{frames.set(++next,callback);return next;});
 vi.stubGlobal('cancelAnimationFrame',id=>frames.delete(id));
 root=document.createElement('div');document.body.append(root);
 const data={types:defaultTypes(),students:[],records:[]};
 const event={id:'e',title:'Встреча',typeId:'personal',date:'2026-11-05',start:600,duration:60,status:'planned',fields:{}};
 for(let cycle=0;cycle<25;cycle++) {
  await act(()=>render(<EventCard event={event} data={data} onOpen={()=>{}} onDragStart={()=>{}}/>,root));
  const drag=new Event('dragstart',{bubbles:true});Object.defineProperty(drag,'dataTransfer',{value:{setData:vi.fn(),setDragImage:vi.fn()}});
  await act(()=>root.querySelector('.event-card').dispatchEvent(drag));
  expect(document.querySelectorAll('.event-drag-preview')).toHaveLength(1);
  await act(()=>render(null,root));
  expect(document.querySelector('.event-drag-preview')).toBeNull();expect(frames.size).toBe(0);
 }
});
