import { render } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { EventReminder } from '../src/components/EventReminder.jsx';
let root;
beforeEach(()=>{root=document.createElement('div');document.body.append(root);});
afterEach(()=>{act(()=>render(null,root));root.remove();});
const event={id:'e',title:'Анна',status:'pending'};
it('saves tomorrow for this event and opens an explicit custom time control',async()=>{
 const save=vi.fn(()=>true);
 await act(async()=>render(<EventReminder data={{events:[event]}} event={event} now={Date.parse('2026-11-05T12:00:00Z')} onSave={save}/>,root));
 await act(async()=>[...root.querySelectorAll('button')].find(button=>button.textContent==='Завтра в 09:00').click());
 expect(save).toHaveBeenCalledWith('2026-11-06T09:00');
 await act(async()=>[...root.querySelectorAll('button')].find(button=>button.textContent==='Выбрать дату и время').click());
 expect(root.querySelector('input[type=datetime-local]')).not.toBeNull();
 expect(root.textContent).toContain('при закрытом сайте пока не подключены');
});
it('keeps the editor open with an error if saving fails',async()=>{
 await act(async()=>render(<EventReminder data={{events:[event]}} event={event} onSave={()=>{throw new Error('Нет интернета');}}/>,root));
 await act(async()=>root.querySelector('button').click());
 expect(root.querySelector('[role=alert]').textContent).toBe('Нет интернета');
 expect(root.querySelector('button').disabled).toBe(false);
});
