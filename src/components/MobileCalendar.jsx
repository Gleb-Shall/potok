import { calendarSlotsByDay } from '../lib/timing.js';
import { useEffect, useState } from 'preact/hooks';
import { addDays, monthStart, weekdayOf } from '../lib/domain.js';
import { calendarRange, eventColor, eventTitle } from '../lib/events.js';
import { Icon } from './Icon.jsx';
import { Button, dateLabel, longDays, Search } from './UI.jsx';

const PHONE_WIDTH = '(max-width: 760px)';
const WEEKDAYS = ['П', 'В', 'С', 'Ч', 'П', 'С', 'В'];
const titleCase = value => value[0].toLocaleUpperCase('ru') + value.slice(1);
const monthName = date => titleCase(dateLabel(date, { day: undefined, month: 'long' }));
const fullDate = date => dateLabel(date, { weekday: 'long', year: 'numeric' });
const daysOf = ({ start, count }) => Array.from({ length: count }, (_, index) => addDays(start, index));

export function useMobileCalendarViewport() {
  const [mobile, setMobile] = useState(() => Boolean(window.matchMedia?.(PHONE_WIDTH).matches));
  useEffect(() => {
    const media = window.matchMedia?.(PHONE_WIDTH);
    const update = () => setMobile(Boolean(media?.matches));
    media?.addEventListener('change', update);
    update();
    return () => media?.removeEventListener('change', update);
  }, []);
  return mobile;
}

export function MobileCalendarHeader({ level, date, onBack, onAdd, query, onQuery, options }) {
  const [open, setOpen] = useState('');
  useEffect(() => setOpen(''), [level]);
  const toggle = panel => setOpen(previous => previous === panel ? '' : panel);
  return <header class="mobile-calendar-header">
    <h1 class="sr-only">Расписание</h1>
    <div class="mobile-calendar-toolbar">
      {level !== 'year' && <button type="button" class="mobile-calendar-pill mobile-calendar-back" onClick={onBack}>
        <Icon name="left"/><span>{level === 'day' ? monthName(date) : date.slice(0, 4)}</span>
      </button>}
      <div class="mobile-calendar-pill mobile-calendar-actions">
        {level !== 'year' && <button type="button" aria-label="Вид и фильтры" aria-expanded={open === 'options'} onClick={() => toggle('options')}><Icon name="sliders"/></button>}
        <button type="button" aria-label="Поиск событий" aria-expanded={open === 'search'} aria-pressed={Boolean(query)} onClick={() => toggle('search')}><Icon name="search"/></button>
        <button type="button" aria-label="Добавить событие" onClick={() => { setOpen(''); onAdd(); }}><Icon name="plus"/></button>
      </div>
    </div>
    {open === 'search' && <div class="mobile-calendar-tool-panel mobile-calendar-search"><Search value={query} onChange={onQuery}/>{query && <button type="button" class="text-button" onClick={() => onQuery('')}>Сбросить</button>}</div>}
    {open === 'options' && <div class="mobile-calendar-tool-panel">{options}</div>}
  </header>;
}

export function MobileCalendarWeek({ date, today, onDate, dropDate }) {
  return <div class="mobile-calendar-day-heading">
    <nav class="mobile-calendar-week" aria-label="Дни недели">{daysOf(calendarRange(date, 'week')).map((day, index) =>
      <button type="button" key={day} aria-label={fullDate(day)} aria-current={day === today ? 'date' : undefined}
        aria-pressed={day === date} data-timeline-drop-date={day} data-timeline-drop-hover={dropDate===day ? '' : undefined} class={index > 4 ? 'is-weekend' : ''} onClick={() => onDate(day)}>
        <span aria-hidden="true">{WEEKDAYS[index]}</span><strong>{Number(day.slice(-2))}</strong>
      </button>)}</nav>
    <h2>{longDays[weekdayOf(date)]} — {dateLabel(date, { year: 'numeric' })}</h2>
  </div>;
}

function OverviewHeading({ title, period, onStep }) {
  return <div class="mobile-calendar-overview-heading">
    <h2>{title}</h2>
    <div class="mobile-calendar-period-buttons">
      <button type="button" class="icon-button" aria-label={`Предыдущий ${period}`} onClick={() => onStep(-1)}><Icon name="left"/></button>
      <button type="button" class="icon-button" aria-label={`Следующий ${period}`} onClick={() => onStep(1)}><Icon name="right"/></button>
    </div>
  </div>;
}

export function MobileCalendarMonth({ date, today, data, events, onDate, onStep }) {
  const month = date.slice(0, 7);
  const eventsByDate = calendarSlotsByDay(events);
  return <section class="mobile-calendar-overview" aria-label="Календарь на месяц">
    <OverviewHeading title={monthName(date)} period="месяц" onStep={onStep}/>
    <div class="mobile-calendar-month-weekdays" aria-hidden="true">{WEEKDAYS.map((day, index) => <span key={index}>{day}</span>)}</div>
    <div class="mobile-calendar-month-grid">{daysOf(calendarRange(date, 'month')).map((day, index) => {
      if (!day.startsWith(month)) return <span key={day} class="mobile-calendar-date-blank" aria-hidden="true"/>;
      const entries = eventsByDate.get(day) || [];
      return <button type="button" key={day} class={index % 7 > 4 ? 'is-weekend' : ''} aria-label={fullDate(day)}
        aria-current={day === today ? 'date' : undefined} aria-pressed={day === date} onClick={() => onDate(day)}>
        <strong>{Number(day.slice(-2))}</strong>
        {entries.slice(0, 2).map(({event}) => <span key={event.id} class="mobile-calendar-event" style={{ '--event-tint': `var(--card-${eventColor(data, event)}, var(--surface-soft))` }}>{eventTitle(data, event)}</span>)}
        {entries.length > 2 && <small aria-hidden="true">+{entries.length - 2}</small>}
      </button>;
    })}</div>
  </section>;
}

export function MobileCalendarYear({ date, today, onMonth, onStep }) {
  const year = date.slice(0, 4);
  return <section class="mobile-calendar-overview mobile-calendar-year" aria-label="Календарь на год">
    <OverviewHeading title={year} period="год" onStep={onStep}/>
    <div class="mobile-calendar-year-grid">{Array.from({ length: 12 }, (_, index) => {
      const month = monthStart(`${year}-01-01`, index);
      const prefix = month.slice(0, 7);
      return <button type="button" key={month} aria-label={`${monthName(month)} ${year}`} onClick={() => onMonth(month)}>
        <strong class={today.startsWith(prefix) ? 'is-current-month' : ''}>{monthName(month)}</strong>
        <span class="mobile-calendar-mini-days" aria-hidden="true">{daysOf(calendarRange(month, 'month')).map(day =>
          <span key={day} class={day === today && day.startsWith(prefix) ? 'is-today' : ''}>{day.startsWith(prefix) ? Number(day.slice(-2)) : ''}</span>)}</span>
      </button>;
    })}</div>
  </section>;
}

export function MobileCalendarFooter({ onToday, children }) {
  return <div class="mobile-calendar-footer">
    <Button kind="secondary mobile-calendar-today" onClick={onToday}>Сегодня</Button>
    {children}
  </div>;
}
