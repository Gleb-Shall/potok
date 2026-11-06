import { eventColor, eventTitle } from '../lib/events.js';

// Shared list geometry; each view supplies its own dates, status and actions.
export function EventListRow({ data, event, leading, meta, trailing, onOpen, children, actions }) {
  return <article class="activity-row" data-activity-id={event.id}>
    <button type="button" class="activity-open" onClick={() => onOpen(event)}>
      <span class="activity-time">{leading}</span>
      <span class={`activity-dot color-${eventColor(data,event)}`} aria-hidden="true"/>
      <span class="activity-identity"><strong>{eventTitle(data,event)}</strong>{meta && <small>{meta}</small>}</span>
      {trailing && <span class="activity-trailing">{trailing}</span>}
    </button>
    {(children || actions) && <div class="activity-support">{children && <div class="activity-links">{children}</div>}{actions && <div class="activity-actions">{actions}</div>}</div>}
  </article>;
}
