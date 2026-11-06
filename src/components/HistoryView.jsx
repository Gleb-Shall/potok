import { useMemo, useState } from 'preact/hooks';
import { historyEvents } from '../lib/event-history.js';
import { eventMatches, eventTitle, eventType, getRecord } from '../lib/events.js';
import { eventLinks } from '../lib/links.js';
import { minutesToTime } from '../lib/domain.js';
import { EventListRow } from './EventListRow.jsx';
import { MonthSelector } from './MonthSelector.jsx';
import { ExternalLink } from './LinkedValue.jsx';
import { Button, Search, dateLabel } from './UI.jsx';

export function HistoryView({ data, now, onOpen, onStatus }) {
  const [month,setMonth] = useState(()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Moscow'}).format(new Date(now)).slice(0,7));
  const [status,setStatus] = useState('all');
  const [query,setQuery] = useState('');
  const entries = useMemo(()=>historyEvents(data,month,status,now).filter(event=>eventMatches(data,event,query)),[data,month,status,now,query]);
  const groups = useMemo(()=>[...new Set(entries.map(event=>event.date))],[entries]);
  const completed = entries.filter(event=>event.status==='done');
  const hours = completed.reduce((total,event)=>total+event.duration,0)/60;

  return <section class="history-view" aria-label="История событий">
    <div class="activity-toolbar"><MonthSelector value={month} onChange={setMonth} label="История"/>
      <select class="activity-filter" aria-label="Статус в истории" value={status} onChange={event=>setStatus(event.currentTarget.value)}><option value="all">Все события</option><option value="done">Проведено</option><option value="unconfirmed">Не отмечено</option><option value="cancelled">Отменено</option></select>
      <Search value={query} onChange={setQuery} placeholder="Поиск в истории"/>
    </div>
    <div class="activity-summary"><span>События <strong>{entries.length}</strong></span>{completed.length>0 && <><span>Проведено <strong>{completed.length}</strong></span><span><strong>{hours.toLocaleString('ru-RU',{maximumFractionDigits:1})}</strong> ч</span></>}</div>
    {groups.map(date=><section class="activity-day" key={date}><h2>{dateLabel(date,{weekday:'long'})}</h2>
      <div class="activity-list">{entries.filter(event=>event.date===date).map(event=>{
        const type=eventType(data,event), record=getRecord(data,event);
        const links=eventLinks(type.fields.filter(field=>!field.archived && field.showOnCard!==false),event.fields,record);
        const label=event.status==='done'?'Проведено':event.status==='cancelled'?'Отменено':'Не отмечено';
        return <EventListRow key={event.id} data={data} event={event} onOpen={onOpen}
          leading={<><time>{minutesToTime(event.start)}</time><small>{minutesToTime(event.start+event.duration)}</small></>}
          meta={[type.name,record?.name].filter(item=>item && item!==eventTitle(data,event)).join(' · ')}
          trailing={<span class={`activity-status ${event.status==='done'?'is-done':event.status==='cancelled'?'is-cancelled':'is-pending'}`}>{label}</span>}
          actions={event.status==='planned' && <Button kind="small secondary" icon="check" aria-label={`Отметить проведённым: ${event.title || type.name}`} onClick={()=>onStatus(event,'done')}>Проведено</Button>}>
          {links.length>0 && links.map(link=><ExternalLink key={link.id} href={link.href} className="activity-link">{link.label}</ExternalLink>)}
        </EventListRow>;
      })}</div>
    </section>)}
    {!entries.length && <div class="activity-empty"><h2>За этот месяц событий нет</h2><p>Выбери другой месяц или измени фильтр.</p></div>}
    <details class="activity-help"><summary>Об отметках проведения</summary><p>Прошедшее время не означает, что событие состоялось: проведение отмечается отдельно. История сохраняется после завершения повторов.</p></details>
  </section>;
}
