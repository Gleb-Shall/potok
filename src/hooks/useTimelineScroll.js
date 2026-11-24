import {useEffect,useRef} from 'preact/hooks';
import {timelineDropTarget} from '../lib/week-layout.js';

// The loop exists only while dragging near an edge; ordinary scrolling is native.
export function useTimelineScroll(scroller,{draggingId,onHover,grabOffset,grabContinuation,dragPoint,shiftDay}) {
  const latest=useRef(null);latest.current={onHover,grabOffset,grabContinuation,shiftDay};
  useEffect(()=>{
    if(!draggingId)return;
    let frame=0,point=dragPoint?.current, edge=0, edgeTime=0, paged=false;
    const speed=(value,min,max)=>value<min+32?-Math.ceil((min+32-value)/5):value>max-32?Math.ceil((value-max+32)/5):0;
    const tick=now=>{
      frame=0;const node=scroller.current;if(!node || !point)return;
      const rect=node.getBoundingClientRect();
      if(point.x<rect.left || point.x>rect.right || point.y<rect.top || point.y>rect.bottom) { edge=0; return; }
      const dx=speed(point.x,rect.left+40,rect.right),dy=speed(point.y,rect.top+70,rect.bottom);
      const beforeX=node.scrollLeft,beforeY=node.scrollTop;
      if (latest.current.shiftDay) {
        const gridLeft=node.querySelector('.week-time-axis')?.getBoundingClientRect().right ?? rect.left;
        const nextEdge=point.x>rect.right-28 ? 1 : point.x<gridLeft+28 ? -1 : 0;
        if (nextEdge!==edge) { edge=nextEdge; edgeTime=now; paged=false; }
        if (edge && !paged && now-edgeTime>=320) {
          paged=true;
          latest.current.shiftDay(edge);
          frame=requestAnimationFrame(tick);
          return;
        }
      } else node.scrollLeft+=dx;
      node.scrollTop+=dy;
      const moved=node.scrollLeft!==beforeX || node.scrollTop!==beforeY;
      // Recheck the lane after paging, even when the finger is stationary.
      if(moved || paged) latest.current.onHover(timelineDropTarget(point,latest.current.grabOffset,latest.current.grabContinuation)||'');
      if(moved || edge && !paged) frame=requestAnimationFrame(tick);
    };
    const move=input=>{const source=input.touches?.[0]||input;point={x:source.clientX,y:source.clientY};if(!frame)frame=requestAnimationFrame(tick);};
    document.addEventListener('mousemove',move);document.addEventListener('touchmove',move,{passive:true});document.addEventListener('dragover',move);
    if (point) frame=requestAnimationFrame(tick);
    return()=>{cancelAnimationFrame(frame);document.removeEventListener('mousemove',move);document.removeEventListener('touchmove',move);document.removeEventListener('dragover',move);};
  },[scroller,draggingId,dragPoint]);
}
