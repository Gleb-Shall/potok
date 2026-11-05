import { useEffect, useRef, useState } from 'preact/hooks';
import { createPortal } from 'preact/compat';
import { Modal, Button } from './UI.jsx';
import { Icon } from './Icon.jsx';

const pad = value => String(value).padStart(2,'0');
const ROW = 44;
function Wheel({ value, count, label, onChange }) {
  const ref = useRef(null), frame = useRef(0);
  useEffect(() => () => cancelAnimationFrame(frame.current), []);
  const select = next => { ref.current.scrollTop = next * ROW; onChange(next); };
  return <div class="time-wheel-column"><span>{label}</span><div ref={ref} class="time-wheel-list" role="listbox" aria-label={label} aria-activedescendant={`wheel-${label}-${value}`} tabIndex={0} onScroll={() => {
    if (frame.current) return;
    frame.current = requestAnimationFrame(() => { frame.current=0; onChange(Math.max(0,Math.min(count-1,Math.round(ref.current.scrollTop/ROW)))); });
  }} onKeyDown={event => {
    if (!['ArrowUp','ArrowDown','Home','End','PageUp','PageDown'].includes(event.key)) return;
    event.preventDefault();
    const next = event.key==='Home'?0:event.key==='End'?count-1:value+(event.key==='ArrowUp'?-1:event.key==='ArrowDown'?1:event.key==='PageUp'?-5:5);
    select(Math.max(0,Math.min(count-1,next)));
  }}>{Array.from({length:count},(_,index)=><div key={index} id={`wheel-${label}-${index}`} role="option" aria-selected={index===value} class="time-wheel-option" onClick={()=>select(index)}>{pad(index)}</div>)}</div></div>;
}

export function TimeInput({ value='', onChange, label='Время', ...props }) {
  const [mobile,setMobile] = useState(() => window.matchMedia?.('(max-width:760px)').matches || false);
  const [open,setOpen] = useState(false);
  const [draft,setDraft] = useState({hour:9,minute:0});
  useEffect(()=>{
    const media=window.matchMedia?.('(max-width:760px)');
    if (!media) return;
    const changed=()=>{setMobile(media.matches);setOpen(false);};media.addEventListener('change',changed);
    return()=>media.removeEventListener('change',changed);
  },[]);
  if (!mobile) return <input type="time" value={value} aria-label={label} onInput={event=>onChange(event.currentTarget.value)} {...props}/>;
  return <><button type="button" class="time-wheel-trigger" aria-label={label} aria-haspopup="dialog" disabled={props.disabled} onClick={()=>{
    const [hour,minute]=(value || '09:00').split(':').map(Number);
    setDraft({hour:Math.min(23,Math.max(0,hour||0)),minute:Math.min(59,Math.max(0,minute||0))});setOpen(true);
  }}><span>{value || 'Выбрать'}</span><Icon name="down"/></button>{open && createPortal(<Modal title={label} className="time-wheel-dialog" onClose={()=>setOpen(false)} onOpen={dialog=>{const columns=dialog.querySelectorAll('.time-wheel-list');columns[0].scrollTop=draft.hour*ROW;columns[1].scrollTop=draft.minute*ROW;}}>
    <div class="time-wheels"><Wheel label="Часы" value={draft.hour} count={24} onChange={hour=>setDraft(previous=>({...previous,hour}))}/><span class="time-wheel-colon" aria-hidden="true">:</span><Wheel label="Минуты" value={draft.minute} count={60} onChange={minute=>setDraft(previous=>({...previous,minute}))}/></div>
    <div class="time-wheel-footer"><Button onClick={()=>setOpen(false)}>Отмена</Button><Button kind="primary" onClick={()=>{onChange(`${pad(draft.hour)}:${pad(draft.minute)}`);setOpen(false);}}>Готово</Button></div>
  </Modal>,document.body)}</>;
}
