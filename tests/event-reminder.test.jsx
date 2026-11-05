import { render } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { EventReminder } from '../src/components/EventReminder.jsx';
let root;
beforeEach(()=>{root=document.createElement('div');document.body.append(root);});
afterEach(()=>{act(()=>render(null,root));root.remove();});
const event={id:'e',title:'Анна',status:'pending'};
it('saves tomorrow and edits date and time through separate always-visible controls',async()=>{
 const save=vi.fn(()=>true);
 await act(async()=>render(<EventReminder data={{events:[event]}} event={event} now={Date.parse('2026-11-05T12:00:00Z')} onSave={save}/>,root));
 await act(async()=>[...root.querySelectorAll('button')].find(button=>button.textContent==='Завтра в 09:00').click());
 expect(save).toHaveBeenCalledWith('2026-11-06T09:00');
 const date=root.querySelector('input[type=date]'),time=root.querySelector('input[type=time]');
 expect(date).not.toBeNull();expect(time).not.toBeNull();
 await act(async()=>{date.value='2026-11-07';date.dispatchEvent(new Event('input',{bubbles:true}));});
 await act(async()=>{time.value='18:45';time.dispatchEvent(new Event('input',{bubbles:true}));});
 await act(async()=>root.querySelector('form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
 expect(save).toHaveBeenLastCalledWith('2026-11-07T18:45');
 expect(root.textContent).toContain('только внутри приложения');
});
it('keeps the editor open with an error if saving fails',async()=>{
 await act(async()=>render(<EventReminder data={{events:[event]}} event={event} onSave={()=>{throw new Error('Нет интернета');}}/>,root));
 await act(async()=>root.querySelector('button').click());
 expect(root.querySelector('[role=alert]').textContent).toBe('Нет интернета');
 expect(root.querySelector('button').disabled).toBe(false);
});
