import {useEffect,useRef,useState} from 'preact/hooks';
import {HOUR_HEIGHT,TIME_STEP} from '../lib/week-layout.js';

export function resizedTiming(event,edge,delta,startBound=0,endBound=1440) {
  const shift=Math.round(delta/TIME_STEP)*TIME_STEP,end=event.start+event.duration,minimum=Math.min(TIME_STEP,event.duration);
  if(edge==='start') {
    const start=Math.max(startBound,Math.min(end-minimum,event.start+shift));
    return {start,duration:end-start};
  }
  return {start:event.start,duration:Math.max(minimum,Math.min(endBound-event.start,event.duration+shift))};
}

export function useEventResize({scroller,bounds,onResize,onActiveChange}) {
  const [preview,setPreview]=useState(null);
  const options=useRef(null),cancelRef=useRef(null);
  options.current={onResize,onActiveChange};
  useEffect(()=>()=>cancelRef.current?.(),[]);
  function begin(event,edge,input) {
    if(!onResize || input.button!==0 || input.isPrimary===false)return;
    input.preventDefault();input.stopPropagation();cancelRef.current?.();
    const origin=input.clientY,scrollTop=scroller.current?.scrollTop || 0,id=input.pointerId;
    let closed=false,frame=0,next={start:event.start,duration:event.duration};
    setPreview({id:event.id,...next});options.current.onActiveChange?.(true);
    const calculate=eventInput=>resizedTiming(event,edge,(eventInput.clientY-origin+(scroller.current?.scrollTop || 0)-scrollTop)/HOUR_HEIGHT*60,bounds.start,bounds.end);
    const paint=()=>{frame=0;setPreview({id:event.id,...next});};
    const finish=(commit=false)=>{
      if(closed)return;closed=true;cancelAnimationFrame(frame);
      document.removeEventListener('pointermove',move);document.removeEventListener('pointerup',up);document.removeEventListener('pointercancel',cancel);document.removeEventListener('keydown',key);window.removeEventListener('blur',cancel);
      cancelRef.current=null;setPreview(null);options.current.onActiveChange?.(false);
      if(commit && (next.start!==event.start || next.duration!==event.duration))options.current.onResize?.(event,next);
    };
    const move=eventInput=>{if(eventInput.pointerId!==id)return;eventInput.preventDefault();next=calculate(eventInput);if(!frame)frame=requestAnimationFrame(paint);};
    const up=eventInput=>{if(eventInput.pointerId!==id)return;eventInput.preventDefault();next=calculate(eventInput);finish(true);};
    const cancel=()=>finish();
    const key=eventInput=>{if(eventInput.key==='Escape'){eventInput.preventDefault();cancel();}};
    cancelRef.current=cancel;
    document.addEventListener('pointermove',move,{passive:false});document.addEventListener('pointerup',up);document.addEventListener('pointercancel',cancel);document.addEventListener('keydown',key);window.addEventListener('blur',cancel);
  }
  function keyboard(event,edge,input) {
    if(!onResize || !['ArrowUp','ArrowDown'].includes(input.key))return;
    input.preventDefault();input.stopPropagation();
    const delta=(input.key==='ArrowUp'?-1:1)*(input.shiftKey?60:TIME_STEP);
    const next=resizedTiming(event,edge,delta,bounds.start,bounds.end);
    if(next.start!==event.start || next.duration!==event.duration)onResize(event,next);
  }
  return {preview,begin,keyboard};
}
