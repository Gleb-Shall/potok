import { useEffect, useId, useRef, useState } from 'preact/hooks';
import { createPortal } from 'preact/compat';
import { Modal, Button } from './UI.jsx';
import { Icon } from './Icon.jsx';

const pad = value => String(value).padStart(2,'0');
const ROW = 44;
const CYCLES = 5;
const CENTER = 2;
const rowIndex = (list,count) => Math.max(0,Math.min(CYCLES*count-1,Math.round(list.scrollTop / ROW)));
const wheelValue = (list,count) => rowIndex(list,count) % count;

function Wheel({ listRef, value, count, label }) {
  const id = useId();
  const [index,setIndex] = useState(CENTER*count+value);
  const frame = useRef(0), settle = useRef(0);
  useEffect(() => () => { cancelAnimationFrame(frame.current); clearTimeout(settle.current); }, []);
  const select = next => {
    listRef.current.scrollTop = next*ROW;
    setIndex(next);
  };
  const recenter = () => {
    const list = listRef.current;
    if (!list) return;
    const current = rowIndex(list,count);
    if (Math.floor(current/count)!==CENTER) select(CENTER*count+current%count);
  };
  const cycle = Math.floor(index/count);
  return <div class="time-wheel-column"><span>{label}</span><div class="time-wheel-focus"><div ref={listRef} class="time-wheel-list" role="listbox" aria-label={label} aria-activedescendant={`${id}-${index}`} tabIndex={0} onScroll={() => {
    clearTimeout(settle.current);
    settle.current = setTimeout(recenter,160);
    if (frame.current) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      if (listRef.current) setIndex(rowIndex(listRef.current,count));
    });
  }} onKeyDown={event => {
    if (!['ArrowUp','ArrowDown','Home','End','PageUp','PageDown'].includes(event.key)) return;
    event.preventDefault();
    const current = wheelValue(listRef.current,count);
    const next = event.key==='Home'?0:event.key==='End'?count-1:current+(event.key==='ArrowUp'?-1:event.key==='ArrowDown'?1:event.key==='PageUp'?-5:5);
    select(CENTER*count+((next+count)%count));
  }}>{Array.from({length:count*CYCLES},(_,row)=>{
    const currentCycle = Math.floor(row/count)===cycle;
    return <div key={row} id={`${id}-${row}`} role={currentCycle ? 'option' : undefined}
      aria-hidden={!currentCycle || undefined} aria-selected={currentCycle ? row===index : undefined}
      class="time-wheel-option" onClick={()=>select(row)}>{pad(row%count)}</div>;
  })}</div></div></div>;
}

export function TimeInput({ value='', onChange, label='Время', ...props }) {
  const [mobile,setMobile] = useState(() => window.matchMedia?.('(max-width:760px)').matches || false);
  const [open,setOpen] = useState(false);
  const [draft,setDraft] = useState({hour:9,minute:0});
  const hours = useRef(null);
  const minutes = useRef(null);
  useEffect(()=>{
    const media=window.matchMedia?.('(max-width:760px)');
    if (!media) return;
    const changed=()=>{setMobile(media.matches);setOpen(false);};media.addEventListener('change',changed);
    return()=>media.removeEventListener('change',changed);
  },[]);
  if (!mobile) return <input type="time" value={value} aria-label={label} onInput={event=>onChange(event.currentTarget.value)} {...props}/>;
  return <><button id={props.id} type="button" class="time-wheel-trigger" aria-label={label} aria-haspopup="dialog" disabled={props.disabled} onClick={()=>{
    const [hour,minute]=(value || '09:00').split(':').map(Number);
    setDraft({hour:Math.min(23,Math.max(0,hour||0)),minute:Math.min(59,Math.max(0,minute||0))});setOpen(true);
  }}><span>{value || 'Выбрать'}</span><Icon name="down"/></button>{open && createPortal(<Modal title={label} className="time-wheel-dialog" onClose={()=>setOpen(false)} onOpen={()=>{
    hours.current.scrollTop = (CENTER*24+draft.hour)*ROW;
    minutes.current.scrollTop = (CENTER*60+draft.minute)*ROW;
  }}>
    <div class="time-wheels"><Wheel listRef={hours} label="Часы" value={draft.hour} count={24}/><span class="time-wheel-colon" aria-hidden="true">:</span><Wheel listRef={minutes} label="Минуты" value={draft.minute} count={60}/></div>
    <div class="time-wheel-footer"><Button onClick={()=>setOpen(false)}>Отмена</Button><Button kind="primary" onClick={()=>{
      onChange(`${pad(wheelValue(hours.current, 24))}:${pad(wheelValue(minutes.current, 60))}`);
      setOpen(false);
    }}>Готово</Button></div>
  </Modal>,document.body)}</>;
}
