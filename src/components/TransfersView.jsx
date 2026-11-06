import { useMemo } from 'preact/hooks';
import { EventListRow } from './EventListRow.jsx';
import { dateLabel } from './UI.jsx';
import { Icon } from './Icon.jsx';
import { minutesToTime } from '../lib/domain.js';
const changeLabel = count => `${count} ${{one:'изменение',few:'изменения',many:'изменений',other:'изменения'}[new Intl.PluralRules('ru').select(count)]}`;

export function TransfersView({ data, pending, renderPending, onOpen }) {
  const changed = useMemo(()=>data.events.filter(event=>event.history?.length || event.status==='cancelled').sort((a,b)=>(b.history?.at(-1)?.at || '').localeCompare(a.history?.at(-1)?.at || '')),[data.events]);
  return <section class="transfers-view" aria-label="Переносы событий">
    <section class="activity-section"><header class="activity-section-heading"><h2>Ожидают даты</h2><span class="section-count">{pending.length}</span></header>
      {pending.length ? <div class="pending-list">{pending.map(renderPending)}</div> : <p class="activity-empty">Все события на своих местах.</p>}
    </section>
    <section class="activity-section"><header class="activity-section-heading"><h2>Последние изменения</h2><span class="section-count">{changed.length}</span></header>
      <div class="activity-list">{changed.map(event=><EventListRow key={event.id} data={data} event={event} onOpen={item=>onOpen(item.id)}
        leading={<><span>{dateLabel(event.originalDate || event.anchorDate || event.date)}</span><time>{minutesToTime(event.originalStart ?? event.start)}</time></>}
        meta={event.history?.length ? changeLabel(event.history.length) : 'Изменение статуса'}
        trailing={event.status==='pending' ? <span class="activity-status is-pending">Ждёт даты</span> : event.status==='cancelled' ? <span class="activity-status is-cancelled">Отменено</span> : <span class="activity-destination"><Icon name="arrow"/>{dateLabel(event.date)} · {minutesToTime(event.start)}</span>}/>)}</div>
      {!changed.length && <p class="activity-empty">Здесь появятся переносы и отмены.</p>}
    </section>
  </section>;
}
