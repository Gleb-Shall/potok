import { useMemo } from 'preact/hooks';
import { ActivityStatus, EventListRow } from './EventListRow.jsx';
import { eventAppearance } from '../lib/state-appearance.js';
import { dateLabel } from './UI.jsx';
import { Icon } from './Icon.jsx';
import { minutesToTime } from '../lib/domain.js';
const changeLabel = count => `${count} ${{one:'изменение',few:'изменения',many:'изменений',other:'изменения'}[new Intl.PluralRules('ru').select(count)]}`;

export function TransfersView({ data, pending, renderPending, onOpen }) {
  return <section class="transfers-view" aria-label="Переносы событий">
    <TransferQueue {...{pending,renderPending}}/>
    <TransferHistory {...{data,onOpen}}/>
  </section>;
}

export function TransferQueue({pending,renderPending}) {
  return <section class="activity-section"><header class="activity-section-heading"><h2>Ждут новой даты</h2><span class="section-count">{pending.length}</span></header>
    {pending.length ? <div class="pending-list">{pending.map(renderPending)}</div> : <p class="activity-empty">Все события на своих местах.</p>}
  </section>;
}

export function TransferHistory({data,now,onOpen}) {
  const changed = useMemo(()=>data.events.filter(event=>event.history?.length).sort((a,b)=>(b.history.at(-1).at || '').localeCompare(a.history.at(-1).at || '')),[data.events]);
  return <section class="activity-section"><header class="activity-section-heading"><h2>Последние изменения</h2><span class="section-count">{changed.length}</span></header>
      <div class="activity-list">{changed.map(event=>{
        const last = event.history.at(-1);
        return <EventListRow key={event.id} data={data} event={event} onOpen={item=>onOpen(item.id)}
          leading={<><small>{dateLabel(last.fromDate)}</small>{last.fromDate && <time>{minutesToTime(last.fromStart)}</time>}</>}
          meta={changeLabel(event.history.length)}
          trailing={<>{last.toDate && <span class="activity-destination"><Icon name="arrow"/>{dateLabel(last.toDate)} · {minutesToTime(last.toStart)}</span>}<ActivityStatus appearance={eventAppearance(event,{now})}/></>}/>;
      })}</div>
      {!changed.length && <p class="activity-empty">Здесь появятся изменения даты и времени.</p>}
    </section>;
}
