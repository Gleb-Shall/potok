import { useState } from 'preact/hooks';
import { historyEvents } from '../lib/event-history.js';
import { eventMatches } from '../lib/events.js';
import { EventCard } from './EventCard.jsx';
import { Field, Search, dateLabel } from './UI.jsx';

export function HistoryView({ data, now, onOpen, onStatus }) {
  const [month, setMonth] = useState(() => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Moscow' }).format(new Date(now)).slice(0, 7));
  const [status, setStatus] = useState('all');
  const [query, setQuery] = useState('');
  const entries = historyEvents(data, month, status, now).filter(event => eventMatches(data, event, query));
  const groups = [...new Set(entries.map(event => event.date))];
  const navigate = direction => { const date = new Date(month + '-01T00:00:00Z'); date.setUTCMonth(date.getUTCMonth() + direction); setMonth(date.toISOString().slice(0, 7)); };
  return <section class="event-history-panel">
    <div class="history-toolbar"><div class="week-navigation"><button class="icon-button" aria-label="Предыдущий месяц истории" onClick={() => navigate(-1)}>‹</button><Field label="Месяц истории" type="month" value={month} onChange={value => { if (/^\d{4}-\d{2}$/.test(value)) setMonth(value); }}/><button class="icon-button" aria-label="Следующий месяц истории" onClick={() => navigate(1)}>›</button></div>
      <select class="type-filter" aria-label="Статус в истории" value={status} onChange={event => setStatus(event.currentTarget.value)}><option value="all">Все прошедшие</option><option value="done">Проведено</option><option value="unconfirmed">Проведение не отмечено</option><option value="cancelled">Отменено</option></select><Search value={query} onChange={setQuery} placeholder="Поиск в истории"/>
    </div>
    <p class="directory-note">История хранится вместе с расписанием. Прошедшее время не означает, что событие состоялось: проведение отмечается отдельно.</p>
    <div class="history-summary"><span><strong>{entries.length}</strong> событий</span><span><strong>{entries.filter(item => item.status === 'done').length}</strong> проведено</span><span><strong>{Math.round(entries.filter(item => item.status === 'done').reduce((total, item) => total + item.duration, 0) / 60 * 10) / 10}</strong> ч проведено</span></div>
    {groups.map(date => <section class="history-day" key={date}><h2>{dateLabel(date, { weekday: 'long', year: 'numeric' })}</h2><div class="history-event-grid">{entries.filter(event => event.date === date).map(event => <div key={event.id}><EventCard event={event} data={data} now={now} expanded onOpen={id => onOpen(entries.find(item => item.id === id))}/>{event.status === 'planned' && <button type="button" class="text-button history-complete" onClick={() => onStatus(event, 'done')}>Отметить проведённым</button>}</div>)}</div></section>)}
    {!entries.length && <div class="empty-state"><h3>За этот месяц событий нет</h3><p>Выбери другой месяц или измени фильтр. Прошлые события остаются здесь после завершения повторов.</p></div>}
  </section>;
}
