import { eventHasEnded } from './event-history.js';

// Presentation is independent of saved event statuses. Future preferences can
// replace effects per state without changing events or confirming attendance.
export const DEFAULT_STATE_EFFECTS = Object.freeze({
  elapsed: 'marker',
  confirmed: 'marker',
  cancelled: 'plain',
  planned: 'plain',
  pastDay: 'marker',
});

const STATES = {
  planned: { label: 'Запланировано', icon: null },
  elapsed: { label: 'Время прошло, проведение не подтверждено', icon: 'clock' },
  confirmed: { label: 'Проведение подтверждено', icon: 'check' },
  cancelled: { label: 'Событие отменено', icon: 'close' },
};

export function eventAppearance(event, { now = Date.now(), preview = false, effects = DEFAULT_STATE_EFFECTS } = {}) {
  const state = preview ? 'planned' : event.status === 'done' ? 'confirmed' : event.status === 'cancelled' ? 'cancelled' : eventHasEnded(event, now) ? 'elapsed' : 'planned';
  return { state, ...STATES[state], effect: effects[state] || DEFAULT_STATE_EFFECTS[state] };
}
