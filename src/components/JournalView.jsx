import { useMemo, useState } from 'preact/hooks';
import { unconfirmedEvents } from '../lib/event-history.js';
import { eventMatches } from '../lib/events.js';
import { HistoryRow, HistoryView } from './HistoryView.jsx';
import { TransferHistory, TransferQueue } from './TransfersView.jsx';
import { Search } from './UI.jsx';

export function JournalView({data, now, pending, renderPending, onOpenEvent, onOpenTransfer, onStatus}) {
  const [archive, setArchive] = useState('events');
  const [query, setQuery] = useState('');
  const waiting = useMemo(() => unconfirmedEvents(data, now), [data, now]);
  const visibleWaiting = query ? waiting.filter(event => eventMatches(data,event,query)) : waiting;
  return <section class="journal-view" aria-label="Журнал">
    <section class="activity-section">
      <header class="activity-section-heading journal-queue-heading"><h2>Ждут подтверждения</h2><span class="section-count">{waiting.length}</span>{waiting.length > 0 && <Search value={query} onChange={setQuery} placeholder="Поиск ожидающих"/>}</header>
      {visibleWaiting.length ? <div class="activity-list">{visibleWaiting.map(event => <HistoryRow key={event.id} data={data} event={event} now={now} onOpen={onOpenEvent} onStatus={onStatus} showDate allowCancellation/>)}</div> :
        <p class="activity-empty">{waiting.length ? 'События не найдены.' : 'Все прошедшие события отмечены.'}</p>}
    </section>
    <TransferQueue pending={pending} renderPending={renderPending}/>
    <section class="activity-section journal-archive" aria-label="Архив журнала">
      <header class="activity-section-heading journal-archive-heading">
        <h2>Архив</h2>
        <div class="week-layout-switch" role="group" aria-label="Раздел архива">
          <button type="button" aria-pressed={archive==='events'} onClick={()=>setArchive('events')}>Проведённые и отменённые</button>
          <button type="button" aria-pressed={archive==='moves'} onClick={()=>setArchive('moves')}>История переносов</button>
        </div>
      </header>
      <div hidden={archive!=='events'}><HistoryView data={data} now={now} onOpen={onOpenEvent} onStatus={onStatus} archiveOnly/></div>
      {archive==='moves' && <TransferHistory data={data} now={now} onOpen={onOpenTransfer}/>}
    </section>
  </section>;
}
