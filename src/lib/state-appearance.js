import { eventState } from './event-history.js';

// Presentation is independent of saved event statuses. Future preferences can
// replace effects per state without changing events or confirming attendance.
export const DEFAULT_STATE_EFFECTS = Object.freeze({
  elapsed: 'marker',
  confirmed: 'marker',
  cancelled: 'plain',
  pending: 'plain',
  planned: 'plain',
  pastDay: 'marker',
});

export const EVENT_STATES = {
  planned: { label:'Запланировано', icon:null, actions:['complete','cancel','move','defer'] },
  elapsed: { label:'Ждёт подтверждения', icon:'clock', actions:['complete','cancel','move','defer'] },
  pending: { label:'Ждёт новой даты', icon:'clock', actions:['move','remind','restoreSlot','cancel'] },
  confirmed: { label:'Проведено', icon:'check', actions:['reopen'] },
  cancelled: { label:'Отменено', icon:'close', actions:['reopen'] },
};

export function eventAppearance(event, { now = Date.now(), preview = false, effects = DEFAULT_STATE_EFFECTS } = {}) {
  const state = preview ? 'planned' : eventState(event, now);
  return { state, ...EVENT_STATES[state], effect: effects[state] || DEFAULT_STATE_EFFECTS[state] };
}
