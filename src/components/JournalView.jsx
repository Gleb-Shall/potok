import { useMemo, useState } from 'preact/hooks';
import { sortedCopy } from '../lib/array.js';
import { unconfirmedEvents } from '../lib/event-history.js';
import { eventMatches, eventTitle, eventType, getRecord } from '../lib/events.js';
import { ActivityTime, EventListRow } from './EventListRow.jsx';
import { HistoryRow, HistoryView } from './HistoryView.jsx';
import { TransferHistory, TransferQueue } from './TransfersView.jsx';
import { Button, Search } from './UI.jsx';

export function JournalView({data, now, pending, renderPending, onOpenEvent, onOpenTransfer, onStatus, onOpenArchived, onDeleteArchived}) {
  const [archive, setArchive] = useState('events');
  const [query, setQuery] = useState('');
  const waiting = useMemo(() => unconfirmedEvents(data, now), [data, now]);
  const visibleWaiting = query ? waiting.filter(event => eventMatches(data,event,query)) : waiting;
  return <section class="journal-view" aria-label="Журнал">
    <section class="activity-section">
      <header class="activity-section-heading journal-queue-heading"><div class="journal-queue-title"><h2>Ждут подтверждения</h2><span class="section-count">{waiting.length}</span></div>{waiting.length > 0 && <Search value={query} onChange={setQuery} placeholder="Поиск" label="Поиск ожидающих"/>}</header>
      {visibleWaiting.length ? <div class="activity-list">{visibleWaiting.map(event => <HistoryRow key={event.id} data={data} event={event} now={now} onOpen={onOpenEvent} onStatus={onStatus} showDate allowCancellation/>)}</div> :
        <p class="activity-empty">{waiting.length ? 'События не найдены.' : 'Все прошедшие события отмечены.'}</p>}
    </section>
    <TransferQueue pending={pending} renderPending={renderPending}/>
    <section class="activity-section journal-archive" aria-label="Архив журнала">
      <header class="activity-section-heading journal-archive-heading">
        <h2>Архив</h2>
        <div class="week-layout-switch" role="group" aria-label="Раздел архива">
          <button type="button" aria-label="Проведённые и отменённые" aria-pressed={archive==='events'} onClick={()=>setArchive('events')}><span class="journal-archive-full">Проведённые и отменённые</span><span class="journal-archive-short" aria-hidden="true">События</span></button>
          <button type="button" aria-label="История переносов" aria-pressed={archive==='moves'} onClick={()=>setArchive('moves')}><span class="journal-archive-full">История переносов</span><span class="journal-archive-short" aria-hidden="true">Переносы</span></button>
          {onOpenArchived && <button type="button" aria-label="Из удалённых шаблонов" aria-pressed={archive==='deleted'} onClick={()=>setArchive('deleted')}><span class="journal-archive-full">Из удалённых шаблонов</span><span class="journal-archive-short" aria-hidden="true">Удалённые</span></button>}
        </div>
      </header>
      <div hidden={archive!=='events'}><HistoryView data={data} now={now} onOpen={onOpenEvent} onStatus={onStatus} archiveOnly/></div>
      {archive==='moves' && <TransferHistory data={data} now={now} onOpen={onOpenTransfer}/>}
      {archive==='deleted' && <ArchivedEvents data={data} onOpen={onOpenArchived} onDelete={onDeleteArchived}/>}
    </section>
  </section>;
}

const archiveDate = item => item.date || item.from || item.originalDate || item.anchorDate || '';

function ArchivedEvents({data,onOpen,onDelete}) {
  const entries = sortedCopy(data.eventArchive || [], (a,b)=>archiveDate(b).localeCompare(archiveDate(a)) || b.start-a.start);
  if (!entries.length) return <p class="activity-empty">Здесь появятся события и серии удалённых шаблонов.</p>;
  return <>
    <div class="activity-toolbar"><span>События и серии · {entries.length}</span><Button icon="trash" onClick={()=>onDelete(null)}>Очистить архив</Button></div>
    <div class="activity-list">{entries.map(item=><EventListRow key={`${item.archiveKind || 'event'}:${item.id}`} data={data} event={item}
      leading={<ActivityTime date={archiveDate(item)} start={item.start} duration={item.duration}/>}
      meta={[item.archiveKind==='series' && 'Серия',eventType(data,item).name,getRecord(data,item)?.name].filter(Boolean).join(' · ')}
      onOpen={()=>onOpen({...item,date:archiveDate(item)})}
      actions={<Button kind="small secondary" icon="trash" aria-label={`Удалить из архива: ${eventTitle(data,item)}`} onClick={()=>onDelete(item)}>Удалить</Button>}
    />)}</div>
  </>;
}
