import { useState } from 'preact/hooks';
import { activeReminders, reminderLabel, reminderDateTime, tomorrowReminder } from '../lib/reminders.js';
import { Button } from './UI.jsx';

export function EventReminder({ data, event, onSave, onRemove, now=Date.now(), pushReady=false, onEnablePush }) {
  const reminder = activeReminders(data).find(item => item.eventId === event.id);
  const [editing,setEditing] = useState(false);
  const [value,setValue] = useState(() => reminder ? reminderDateTime(reminder.at) : tomorrowReminder(now));
  const [error,setError] = useState('');
  const [busy,setBusy] = useState(false);
  const [enabled,setEnabled] = useState(false);
  const apply = async date => {
    setError(''); setBusy(true);
    try { const saved = await onSave(date); if (saved !== false) setEditing(false); else setError('Не удалось сохранить напоминание. Проверь подключение и повтори.'); }
    catch (error) { setError(error.message); }
    finally { setBusy(false); }
  };
  return <section class="event-reminder" aria-label="Напоминание о событии"><div class="reminder-heading"><h3>Напомнить о переносе</h3>{reminder && <button type="button" class="text-button" disabled={busy} onClick={onRemove}>Убрать</button>}</div>
    {reminder && <p class="reminder-scheduled">{Date.parse(reminder.at) <= now ? 'Напоминание наступило · ' : ''}{reminderLabel(reminder.at)} · МСК</p>}
    <div class="reminder-presets"><Button disabled={busy} onClick={() => apply(tomorrowReminder(now))}>Завтра в 09:00</Button><Button disabled={busy} onClick={() => setEditing(!editing)} aria-expanded={editing}>{reminder ? 'Изменить время' : 'Выбрать дату и время'}</Button></div>
    {editing && <form class="reminder-time-form" onSubmit={input => { input.preventDefault(); apply(value); }}><label class="field"><span>Когда напомнить · московское время</span><input type="datetime-local" aria-label="Дата и время напоминания" value={value} min={reminderDateTime(now + 60000)} onInput={input => setValue(input.currentTarget.value)} required/></label><button type="submit" class="button primary" disabled={busy}>Сохранить напоминание</button></form>}
    <p class="quiet-note">{pushReady ? 'Можно включить уведомления на этом устройстве, чтобы получать их при закрытом сайте.' : 'Напоминание появится в приложении. Уведомления при закрытом сайте пока не подключены.'}</p>
    {pushReady && onEnablePush && <Button disabled={busy || enabled} onClick={async()=>{ setError('');setBusy(true);try {await onEnablePush();setEnabled(true);}catch(error){setError(error.message);}finally{setBusy(false);}}}>{enabled ? 'Уведомления включены' : 'Включить уведомления на устройстве'}</Button>}
    {error && <p class="background-error" role="alert">{error}</p>}
  </section>;
}
