import { render } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { TimeInput } from '../src/components/TimeInput.jsx';
let root;
beforeEach(()=>{
 root=document.createElement('div');document.body.append(root);
 vi.stubGlobal('matchMedia',()=>({matches:true,addEventListener:vi.fn(),removeEventListener:vi.fn()}));
 HTMLDialogElement.prototype.showModal=function(){this.open=true;};HTMLDialogElement.prototype.close=function(){this.open=false;};
});
afterEach(()=>{act(()=>render(null,root));root.remove();vi.unstubAllGlobals();});
it('uses independent scroll wheels on mobile and commits only after confirmation',async()=>{
 const change=vi.fn();await act(async()=>render(<TimeInput value="09:15" label="Время" onChange={change}/>,root));
 await act(async()=>root.querySelector('button').click());
 const dialog=document.querySelector('.time-wheel-dialog');
 expect(dialog.parentElement).toBe(document.body);
 const wheels=dialog.querySelectorAll('[role=listbox]');expect(wheels).toHaveLength(2);
 expect(wheels[0].querySelectorAll('[role=option]')).toHaveLength(24);
 expect(wheels[1].querySelectorAll('[role=option]')).toHaveLength(60);
 await act(async()=>wheels[0].dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true,cancelable:true})));
 await act(async()=>wheels[1].querySelectorAll('[role=option]')[45].click());
 expect(change).not.toHaveBeenCalled();
 await act(async()=>[...dialog.querySelectorAll('button')].find(button=>button.textContent==='Готово').click());
 expect(change).toHaveBeenCalledWith('10:45');expect(document.querySelector('.time-wheel-dialog')).toBeNull();
});
it('does not change the original time when the wheel is cancelled',async()=>{
 const change=vi.fn();await act(async()=>render(<TimeInput value="23:59" onChange={change}/>,root));
 await act(async()=>root.querySelector('button').click());
 const dialog=document.querySelector('.time-wheel-dialog');
 await act(async()=>dialog.querySelector('[role=option]').click());
 await act(async()=>[...dialog.querySelectorAll('button')].find(button=>button.textContent==='Отмена').click());
 expect(change).not.toHaveBeenCalled();
});
