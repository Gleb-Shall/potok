import {useEffect,useRef} from 'preact/hooks';
import {timelineDropTarget} from '../lib/week-layout.js';

// The loop exists only while dragging near an edge; ordinary scrolling is native.
export function useTimelineScroll(scroller,draggingId,duration,onHover,grabOffset=0) {
  const latest=useRef(null);latest.current={duration,onHover,grabOffset};
  useEffect(()=>{
    if(!draggingId)return;
    let frame=0,point;
    const speed=(value,min,max)=>value<min+32?-Math.ceil((min+32-value)/5):value>max-32?Math.ceil((value-max+32)/5):0;
    const tick=()=>{
      frame=0;const node=scroller.current;if(!node || !point)return;
      const rect=node.getBoundingClientRect();
      if(point.x<rect.left || point.x>rect.right || point.y<rect.top || point.y>rect.bottom)return;
      const dx=speed(point.x,rect.left+40,rect.right),dy=speed(point.y,rect.top+70,rect.bottom);
      const beforeX=node.scrollLeft,beforeY=node.scrollTop;
      node.scrollLeft+=dx;node.scrollTop+=dy;
      if(node.scrollLeft!==beforeX || node.scrollTop!==beforeY){
        latest.current.onHover(timelineDropTarget(point,latest.current.duration,latest.current.grabOffset)||'');
        frame=requestAnimationFrame(tick);
      }
    };
    const move=input=>{const source=input.touches?.[0]||input;point={x:source.clientX,y:source.clientY};if(!frame)frame=requestAnimationFrame(tick);};
    document.addEventListener('mousemove',move);document.addEventListener('touchmove',move,{passive:true});document.addEventListener('dragover',move);
    return()=>{cancelAnimationFrame(frame);document.removeEventListener('mousemove',move);document.removeEventListener('touchmove',move);document.removeEventListener('dragover',move);};
  },[scroller,draggingId]);
}
