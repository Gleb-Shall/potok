import { activeReminders, nextReminderAt, reminderMessage } from './reminder-model.js';
export { activeReminders, nextReminderAt, reminderMessage };
export const REMINDER_ZONE = 'Europe/Moscow';
export function reminderDateTime(value) {
  const parts = new Intl.DateTimeFormat('sv-SE', { timeZone:REMINDER_ZONE, year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', hourCycle:'h23' }).format(new Date(value));
  return parts.replace(' ', 'T');
}
export function tomorrowReminder(now = Date.now()) {
  const today = reminderDateTime(now).slice(0, 10);
  const tomorrow = new Date(`${today}T12:00:00Z`); tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  return `${tomorrow.toISOString().slice(0, 10)}T09:00`;
}
export function parseReminderTime(value, now = Date.now()) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) throw new Error('Выбери дату и время.');
  const at = Date.parse(`${value}:00+03:00`);
  if (!Number.isFinite(at) || reminderDateTime(at) !== value) throw new Error('Проверь дату и время.');
  if (at <= now) throw new Error('Выбери время в будущем.');
  if (at - now > 366 * 86400000) throw new Error('Напоминание можно поставить в пределах года.');
  return new Date(at).toISOString();
}
export function saveReminder(data, eventId, value, now = Date.now()) {
  if (!data.events.some(event => event.id === eventId && event.status === 'pending')) throw new Error('Событие уже не ждёт переноса. Обнови карточку.');
  const reminder = { id:crypto.randomUUID(), eventId, at:parseReminderTime(value, now), timeZone:REMINDER_ZONE };
  const others = activeReminders(data).filter(item => item.eventId !== eventId);
  if (others.length >= 200) throw new Error('Сначала убери одно из существующих напоминаний.');
  return { ...data, reminders:[...others, reminder] };
}
export const removeReminder = (data, eventId) => ({...data, reminders:activeReminders(data).filter(item => item.eventId !== eventId)});
export const reminderLabel = value => new Intl.DateTimeFormat('ru-RU', {timeZone:REMINDER_ZONE, day:'numeric', month:'short', hour:'2-digit', minute:'2-digit'}).format(new Date(value));
