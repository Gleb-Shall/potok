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
  const dates = activeReminders(data).filter(reminder => !settled.has(reminder.id)).map(reminder => Date.parse(reminder.at));
  return dates.length ? Math.min(...dates) : 0;
}
export function reminderMessage(data, reminder) {
  const event = (data.events || []).find(event => event.id === reminder.eventId);
  return { title: typeof event?.title === 'string' ? event.title.slice(0,200) : 'Событие', body: 'Всё ещё ждёт переноса. Выбери новое время.', eventId: reminder.eventId, reminderId: reminder.id };
}
