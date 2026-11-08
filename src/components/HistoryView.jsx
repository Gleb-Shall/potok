import { useMemo, useState } from 'preact/hooks';
import { historyEvents } from '../lib/event-history.js';
import { eventFields, eventMatches, eventTitle, eventType, getRecord } from '../lib/events.js';
import { eventLinks } from '../lib/links.js';
import { ActivityStatus, ActivityTime, EventListRow } from './EventListRow.jsx';
import { eventAppearance, EVENT_STATES } from '../lib/state-appearance.js';
import { MonthSelector } from './MonthSelector.jsx';
import { ExternalLink } from './LinkedValue.jsx';
import { Button, Search, dateLabel } from './UI.jsx';

export function HistoryView({ data, now, onOpen, onStatus, archiveOnly = false }) {
  const [month,setMonth] = useState(()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Moscow'}).format(new Date(now)).slice(0,7));
  const [status,setStatus] = useState('all');
  const [query,setQuery] = useState('');
  const entries = useMemo(()=>historyEvents(data,month,status,now).filter(event=>(!archiveOnly || event.status !== 'planned') && eventMatches(data,event,query)),[data,month,status,now,query,archiveOnly]);
  const groups = useMemo(()=>[...new Set(entries.map(event=>event.date))],[entries]);
  const completed = entries.filter(event=>event.status==='done');
  const hours = completed.reduce((total,event)=>total+event.duration,0)/60;

  return <section class="history-view" aria-label="История событий">
    <div class="activity-toolbar"><MonthSelector value={month} onChange={setMonth} label="История"/>
      <select class="activity-filter" aria-label="Статус в истории" value={status} onChange={event=>setStatus(event.currentTarget.value)}><option value="all">Все события</option><option value="done">{EVENT_STATES.confirmed.label}</option>{!archiveOnly && <option value="unconfirmed">{EVENT_STATES.elapsed.label}</option>}<option value="cancelled">{EVENT_STATES.cancelled.label}</option></select>
      <Search value={query} onChange={setQuery} placeholder="Поиск в истории"/>
    </div>
    <div class="activity-summary"><span>События <strong>{entries.length}</strong></span>{completed.length>0 && <><span>Проведено <strong>{completed.length}</strong></span><span><strong>{hours.toLocaleString('ru-RU',{maximumFractionDigits:1})}</strong> ч</span></>}</div>
    {groups.map(date=><section class="activity-day" key={date}><h2>{dateLabel(date,{weekday:'long'})}</h2>
      <div class="activity-list">{entries.filter(event=>event.date===date).map(event=><HistoryRow key={event.id} {...{data,event,now,onOpen,onStatus}}/>)}</div>
    </section>)}
    {!entries.length && <div class="activity-empty"><h2>За этот месяц событий нет</h2><p>Выбери другой месяц или измени фильтр.</p></div>}
    <details class="activity-help"><summary>Об отметках проведения</summary><p>Прошедшее время не означает, что событие состоялось: проведение отмечается отдельно. История сохраняется после завершения повторов.</p></details>
  </section>;
}

export function HistoryRow({ data, event, now, onOpen, onStatus, showDate = false, allowCancellation = false }) {
  const type = eventType(data,event), record = getRecord(data,event);
  const title = eventTitle(data,event);
  const links = eventLinks(type.fields.filter(field=>!field.archived && field.showOnCard!==false),eventFields(data,event),record);
  const appearance = eventAppearance(event,{now});
  return <EventListRow data={data} event={event} onOpen={onOpen}
    leading={<ActivityTime date={showDate ? event.date : undefined} start={event.start} duration={event.duration}/>}
    meta={[type.name,record?.name].filter(item=>item && item!==title).join(' · ')}
    trailing={<ActivityStatus appearance={appearance}/>}
    actions={appearance.state==='elapsed' && <>
      <Button kind="small secondary" icon="check" aria-label={`Отметить проведённым: ${title}`} onClick={()=>onStatus(event,'done')}>Проведён</Button>
      {allowCancellation && <Button kind="small secondary" icon="close" aria-label={`Отменить событие: ${title}`} onClick={()=>onStatus(event,'cancelled')}>Отменён</Button>}
    </>}>
    {links.length > 0 && links.map(link=><ExternalLink key={link.id} href={link.href} className="activity-link">{link.label}</ExternalLink>)}
  </EventListRow>;
}
