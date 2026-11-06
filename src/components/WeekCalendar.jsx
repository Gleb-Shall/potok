import { useTimelineScroll } from '../hooks/useTimelineScroll.js';
import { CALENDAR_BUFFER_DAYS, useCalendarPan } from '../hooks/useCalendarPan.js';
import { useEffect, useMemo, useRef } from 'preact/hooks';
import { EventCard } from './EventCard.jsx';
import { Icon } from './Icon.jsx';
import { MarkerPaint } from './MarkerPaint.jsx';
import { dateLabel, dayNames, longDays } from './UI.jsx';
import { addDays, weekdayOf, minutesToTime } from '../lib/domain.js';
import { DEFAULT_STATE_EFFECTS } from '../lib/state-appearance.js';
import { HOUR_HEIGHT, layoutDay, minuteAt, readTimeTarget, timeTarget, weekBounds } from '../lib/week-layout.js';

export function WeekCalendar({days,events,ghosts,data,now,today,selectedDate,onSelectDate,onOpen,onCreate,onDragStart,onDragEnd,onDrop,onHover,draggingId,draggedEvent,dropTarget,grabOffset=0,fromHour=0,toHour=24,mobileDays=3,focusKey=0,panEnabled=true,onShift}) {
  const scroller = useRef(null);
  useTimelineScroll(scroller,draggingId,draggedEvent?.duration,onHover,grabOffset);
  useCalendarPan(scroller,{anchor:days[0],selectedDate,dayCount:days.length,mobileDays,focusKey,enabled:panEnabled,onShift});
  const strip = useMemo(()=>Array.from({length:days.length+2*CALENDAR_BUFFER_DAYS},(_,i)=>addDays(days[0],i-CALENDAR_BUFFER_DAYS)),[days[0],days.length]);
  const bounds = useMemo(()=>weekBounds([...events,...ghosts],fromHour,toHour),[events,ghosts,fromHour,toHour]);
  const lanes = useMemo(()=>strip.map(date=>({date,items:layoutDay(events.filter(event=>event.date===date)),ghosts:layoutDay(ghosts.filter(event=>event.date===date))})),[strip,events,ghosts]);
  const height = (bounds.end-bounds.start)/60*HOUR_HEIGHT;
  const hours = Array.from({length:(bounds.end-bounds.start)/60},(_,i)=>bounds.start+i*60);
  const target = readTimeTarget(dropTarget);
  const moscowNow = new Date(now+3*3600000);
  const currentMinute = moscowNow.getUTCHours()*60+moscowNow.getUTCMinutes();
  const showNow = days.includes(today) && currentMinute>=bounds.start && currentMinute<bounds.end;
  useEffect(()=>{
    const first = events.length ? Math.min(...events.map(event=>event.start)) : 9*60;
    const minute = days.includes(today) ? currentMinute-60 : first-30;
    scroller.current.scrollTop = Math.max(0,(minute-bounds.start)/60*HOUR_HEIGHT);
  },[bounds.start,bounds.end,focusKey]);
  const slot = (date,input,offset=grabOffset) => {
    const rect=input.currentTarget.getBoundingClientRect();
    return timeTarget(date,minuteAt(input.clientY-offset/60*HOUR_HEIGHT,rect.top,rect.height,bounds.start,bounds.end,draggedEvent?.duration));
  };
  const position = ({event,column,columns}) => ({top:`${(event.start-bounds.start)/60*HOUR_HEIGHT}px`,height:`${Math.max(18,event.duration/60*HOUR_HEIGHT)}px`,left:`calc(${column/columns*100}% + 3px)`,width:`calc(${100/columns}% - 6px)`});
  return <div class={`week-timeline ${days.length === 1 ? 'is-day-view' : ''}`} style={{'--hour-height':`${HOUR_HEIGHT}px`,'--mobile-day-count':mobileDays,'--week-day-count':days.length,'--rendered-day-count':strip.length}}>
    <div class="week-scroller" ref={scroller} tabIndex="0" aria-label={days.length === 1 ? 'Расписание дня по часам' : 'Недельное расписание по часам'}>
      <div class="week-table">
        <div class="week-axis-heading"><span>МСК</span></div>
        {strip.map(date=><header key={date} class={`week-day-heading ${date===today?'is-today':''} ${date<today?'is-past-day':''}`} data-board-drop={date} data-day-state={date<today?'past':date===today?'today':'future'} data-state-effect={DEFAULT_STATE_EFFECTS.pastDay}>
          {date<today && <MarkerPaint/>}<button type="button" onClick={()=>onSelectDate(date)} aria-label={dateLabel(date,{weekday:'long'})} aria-pressed={date===selectedDate}><span>{dayNames[weekdayOf(date)]}</span><strong>{Number(date.slice(-2))}</strong></button><button type="button" class="week-day-add" aria-label={`Добавить событие на ${dateLabel(date)}`} onClick={()=>onCreate(date)}><Icon name="plus"/></button>
        </header>)}
        <div class="week-time-axis" style={{height:`${height}px`}} aria-hidden="true">{hours.map(minute=><span key={minute} hidden={showNow && Math.abs(minute-currentMinute)<14} style={{top:`${(minute-bounds.start)/60*HOUR_HEIGHT}px`}}>{minutesToTime(minute)}</span>)}{showNow && <time class="week-now-time" dateTime={`${today}T${minutesToTime(currentMinute)}:00+03:00`} style={{top:`${(currentMinute-bounds.start)/60*HOUR_HEIGHT}px`}}>{minutesToTime(currentMinute)}</time>}</div>
        {lanes.map(({date,items,ghosts:old})=><section key={date} class={`week-day-lane ${date===today?'is-today':''}`} style={{height:`${height}px`}} data-time-date={date} data-visible-date={days.includes(date)?date:undefined} data-time-start={bounds.start} data-time-end={bounds.end} data-board-drop={date} aria-label={longDays[weekdayOf(date)]} onDragOver={input=>{
          if(!draggingId) return;input.preventDefault();input.dataTransfer.dropEffect='move';onHover(slot(date,input));
        }} onDragLeave={input=>{if(!input.currentTarget.contains(input.relatedTarget))onHover('');}} onDrop={input=>{input.preventDefault();input.stopPropagation();onDrop(input,slot(date,input));}} onDoubleClick={input=>{
          if(input.target.closest('.week-event'))return;onCreate(date,readTimeTarget(slot(date,input,0)).start);
        }}>
          {old.map(item=><div key={`ghost:${item.event.id}`} class="week-event week-ghost" style={position(item)}><EventCard event={item.event} data={data} onOpen={onOpen} timeline/></div>)}
          {items.map(item=><div key={item.event.id} class={`week-event ${item.event.duration<35?'is-short':item.event.duration<75?'is-medium':''}`} style={position(item)}><EventCard event={item.event} data={data} now={now} onOpen={onOpen} onDragStart={onDragStart} onDragEnd={onDragEnd} isDragging={draggingId===item.event.id} timeline/></div>)}
          {target?.date===date && target.start!==null && draggingId && <div class="week-drop-slot" style={{top:`${(target.start-bounds.start)/60*HOUR_HEIGHT}px`,height:`${(draggedEvent?.duration||60)/60*HOUR_HEIGHT}px`}}><span>{minutesToTime(target.start)}–{minutesToTime(target.start+(draggedEvent?.duration||60))}</span></div>}
          {date===today && currentMinute>=bounds.start && currentMinute<bounds.end && <div class="week-now-line" style={{top:`${(currentMinute-bounds.start)/60*HOUR_HEIGHT}px`}} aria-label={`Сейчас ${minutesToTime(currentMinute)}`}><span/></div>}
        </section>)}
      </div>
    </div>
  </div>;
}
