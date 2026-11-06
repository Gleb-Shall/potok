import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {render} from 'preact';
import {act} from 'preact/test-utils';
import {ExternalLink} from '../src/components/LinkedValue.jsx';

const desktop=vi.hoisted(()=>({enabled:false,open:vi.fn()}));
vi.mock('@tauri-apps/api/core',()=>({isTauri:()=>desktop.enabled}));
vi.mock('@tauri-apps/plugin-opener',()=>({openUrl:desktop.open}));
let root;
beforeEach(()=>{desktop.enabled=true;desktop.open.mockReset().mockResolvedValue(undefined);root=document.createElement('div');document.body.append(root);});
afterEach(async()=>{await act(()=>render(null,root));root.remove();});

it('opens a named card link through the native browser without opening the card',async()=>{
 const card=vi.fn();
 await act(()=>render(<div onClick={card}><ExternalLink href="https://example.com/board">Доска</ExternalLink></div>,root));
 const click=new MouseEvent('click',{bubbles:true,cancelable:true});
 await act(async()=>{root.querySelector('a').dispatchEvent(click);await new Promise(resolve=>setTimeout(resolve,0));});
 expect(click.defaultPrevented).toBe(true);
 expect(desktop.open).toHaveBeenCalledWith('https://example.com/board');
 expect(card).not.toHaveBeenCalled();
});

it('keeps ordinary browser links native',async()=>{
 desktop.enabled=false;
 await act(()=>render(<ExternalLink href="https://example.com">Встреча</ExternalLink>,root));
 const click=new MouseEvent('click',{bubbles:true,cancelable:true});
 // Observe before cancelling the browser's actual navigation in jsdom.
 let prevented;
 root.querySelector('a').addEventListener('click',event=>{prevented=event.defaultPrevented;event.preventDefault();});
 await act(()=>root.querySelector('a').dispatchEvent(click));
 expect(prevented).toBe(false);expect(desktop.open).not.toHaveBeenCalled();
});

it('shows an opening failure with a recoverable address instead of silently failing',async()=>{
 desktop.open.mockRejectedValue(new Error('Browser unavailable'));
 await act(()=>render(<ExternalLink href="https://example.com">Встреча</ExternalLink>,root));
 await act(async()=>{root.querySelector('a').click();await new Promise(resolve=>setTimeout(resolve,0));});
 expect(root.querySelector('[role=alert]').textContent).toContain('https://example.com/');
});
