// Shared by the browser and scheduled sender. No Firebase or browser globals.
export function activeReminders(data) {
  const pending = new Set((Array.isArray(data.events) ? data.events : []).filter(event => event?.status === 'pending').map(event => event.id));
  const seen = new Set();
  return (Array.isArray(data.reminders) ? data.reminders : []).filter(reminder => {
    if (!reminder || typeof reminder.id !== 'string' || !/^[a-zA-Z0-9-]{1,80}$/.test(reminder.id) || typeof reminder.eventId !== 'string' || reminder.eventId.length > 300 || !pending.has(reminder.eventId) || typeof reminder.at !== 'string' || !Number.isFinite(Date.parse(reminder.at)) || seen.has(reminder.eventId)) return false;
    seen.add(reminder.eventId); return true;
  }).slice(0, 200);
}
export function nextReminderAt(data, settled = new Set()) {
  const dates = deliveryReminders(data).filter(reminder => !settled.has(reminder.id)).map(reminder => Date.parse(reminder.at));
  return dates.length ? Math.min(...dates) : 0;
}
export function eventAlerts(data) {
  return (Array.isArray(data.eventAlerts) ? data.eventAlerts : []).filter(alert =>
    typeof alert?.id === 'string' && /^[a-zA-Z0-9-]{1,80}$/.test(alert.id) &&
    typeof alert.eventId === 'string' && alert.eventId.length <= 300 &&
    typeof alert.title === 'string' && alert.title.trim() && alert.title.length <= 200 &&
    (alert.alarmDevice === undefined || isAlarmId(alert.alarmDevice) && isAlarmId(alert.id)) &&
    typeof alert.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(alert.date) &&
    Number.isInteger(alert.start) && alert.start >= 0 && alert.start < 1440 &&
    typeof alert.at === 'string' && Date.parse(alert.at) < eventAlertDeadline(alert)
  ).slice(0, 200);
}
export const isAlarmId = id => typeof id === 'string' && /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(id);
export const eventAlertDeadline = alert => Date.parse(`${alert.date}T00:00:00+03:00`) + alert.start * 60000;
export const deliveryReminders = data => [...activeReminders(data), ...eventAlerts(data).filter(alert=>!alert.alarmDevice)];

export function reminderMessage(data, reminder) {
  if (reminder.date) return { title:reminder.title, body:'Скоро начнётся событие.', eventId:reminder.eventId, reminderId:reminder.id };
  const event = (data.events || []).find(event => event.id === reminder.eventId);
  return { title: typeof event?.title === 'string' ? event.title.slice(0,200) : 'Событие', body: 'Всё ещё ждёт переноса. Выбери новое время.', eventId: reminder.eventId, reminderId: reminder.id };
}
