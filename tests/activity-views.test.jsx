import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { MonthSelector } from '../src/components/MonthSelector.jsx';
import { PendingEventCard } from '../src/components/PendingEvents.jsx';
import { TransfersView } from '../src/components/TransfersView.jsx';
import { HistoryView } from '../src/components/HistoryView.jsx';
import { defaultTypes, moveEvent } from '../src/lib/events.js';

let root;
const data = () => ({students:[],records:[],types:defaultTypes(),series:[],events:[]});
const event = () => ({id:'lesson',title:'Консультация',typeId:'class',date:'2026-10-30',anchorDate:'2026-10-30',start:600,duration:60,status:'planned',fields:{},history:[]});
beforeEach(() => { root=document.createElement('div'); document.body.append(root); });
afterEach(async () => { await act(()=>render(null,root)); root.remove(); });
const mount = element => act(()=>render(element,root));
const click = selector => act(()=>root.querySelector(selector).click());

it('month navigation crosses year boundaries in both directions',async () => {
  const change=vi.fn();
  await mount(<MonthSelector value="2026-01" onChange={change}/>);
  await click('[aria-label="Предыдущий месяц: Период"]');
  expect(change).toHaveBeenLastCalledWith('2025-12');
  await mount(<MonthSelector value="2026-12" onChange={change}/>);
  await click('[aria-label="Следующий месяц: Период"]');
  expect(change).toHaveBeenLastCalledWith('2027-01');
});

it('pending rows keep open, remind, move and restore as separate actions',async () => {
  const pending=moveEvent(event(),null,600,60), open=vi.fn(), remind=vi.fn(), move=vi.fn(), restore=vi.fn();
  await mount(<PendingEventCard data={data()} event={pending} onOpen={open} onRemind={remind} onMove={move} onRestore={restore}/>);
  await click('.pending-open'); expect(open).toHaveBeenCalledWith(pending.id);
  const buttons=[...root.querySelectorAll('.pending-card-actions > .button')];
  await act(()=>buttons[0].click()); expect(remind).toHaveBeenCalledWith(pending);
  await act(()=>buttons[1].click()); expect(move).toHaveBeenCalledWith(pending);
  await click('[aria-haspopup="menu"]');
  await click('[role="menuitem"]'); expect(restore).toHaveBeenCalledWith(pending);
  expect(open).toHaveBeenCalledTimes(1);
});

it('transfer history opens the stored event by id',async () => {
  const workspace=data(), open=vi.fn();
  workspace.events=[moveEvent(event(),'2026-11-01',660,60)];
  await mount(<TransfersView data={workspace} pending={[]} renderPending={()=>null} onOpen={open}/>);
  await click('.activity-open'); expect(open).toHaveBeenCalledWith('lesson');
  expect(root.textContent).toContain('1 изменение');
  expect(root.textContent).toContain('11:00');
});

it('history keeps named links clickable and confirms the exact occurrence',async () => {
  const workspace=data(), entry=event(), status=vi.fn(), open=vi.fn();
  workspace.types.find(type=>type.id==='class').fields.push({id:'call',type:'url',label:'Встреча',linkLabel:'Подключиться',showOnCard:true});
  entry.fields.call='https://example.com/call'; workspace.events=[entry];
  await mount(<HistoryView data={workspace} now={Date.parse('2026-10-31T12:00:00Z')} onOpen={open} onStatus={status}/>);
  expect(root.querySelector('a').textContent).toBe('Подключиться');
  expect(root.querySelector('a').closest('button')).toBeNull();
  expect(root.textContent).not.toContain('https://');
  await click('[aria-label="Отметить проведённым: Консультация"]');
  expect(status).toHaveBeenCalledWith(expect.objectContaining({id:entry.id,date:entry.date}),'done');
  expect(open).not.toHaveBeenCalled();
});
