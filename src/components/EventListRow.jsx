import { eventTitle } from '../lib/events.js';
import { minutesToTime } from '../lib/domain.js';
import { dateLabel } from './UI.jsx';

export function ActivityTime({ date, start, duration }) {
  return <>{date && <small>{dateLabel(date)}</small>}<span><time>{minutesToTime(start)}</time>–<time>{minutesToTime(start+duration)}</time></span></>;
}

export function ActivityStatus({ appearance }) {
  return <span class="activity-status" data-event-state={appearance.state}>{appearance.label}</span>;
}

// Shared list geometry; each view supplies its own dates, status and actions.
export function EventListRow({ data, event, leading, meta, trailing, onOpen, children, actions }) {
  return <article class="activity-row" data-activity-id={event.id}>
    <button type="button" class="activity-open" onClick={() => onOpen(event)}>
      <span class="activity-time">{leading}</span>
      <span class="activity-identity"><strong>{eventTitle(data,event)}</strong>{meta && <small>{meta}</small>}</span>
      {trailing && <span class="activity-trailing">{trailing}</span>}
    </button>
    {actions && <div class="activity-actions">{actions}</div>}
    {children && <div class="activity-links">{children}</div>}
  </article>;
}
