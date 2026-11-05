import { TimeInput } from './TimeInput.jsx';
import { useState } from 'preact/hooks';
import { activeReminders, reminderDateTime, tomorrowReminder } from '../lib/reminders.js';
import { Button } from './UI.jsx';

export function EventReminder({ data, event, onSave, onRemove, now=Date.now(), pushReady=false, onEnablePush, standalone=false }) {
  const reminder = activeReminders(data).find(item => item.eventId === event.id);
  const [value,setValue] = useState(() => reminder ? reminderDateTime(reminder.at) : tomorrowReminder(now));
  const [error,setError] = useState('');
  const [busy,setBusy] = useState(false);
  const [enabled,setEnabled] = useState(false);
  const apply = async date => {
    setError(''); setBusy(true);
    try { const saved = await onSave(date); if (saved === false) setError('Не удалось сохранить напоминание. Проверь подключение и повтори.'); }
    catch (error) { setError(error.message); }
    finally { setBusy(false); }
  };
  return <section class={`event-reminder ${standalone ? 'standalone-reminder' : ''}`} aria-label="Напоминание о событии">{(!standalone || reminder) && <div class="reminder-heading">{!standalone && <h3>Напомнить о переносе</h3>}{reminder && <button type="button" class="text-button" disabled={busy} onClick={onRemove}>Убрать напоминание</button>}</div>}
    {reminder && Date.parse(reminder.at) <= now && <p class="reminder-scheduled">Время напоминания наступило</p>}
    <form class="reminder-time-form" onSubmit={input => { input.preventDefault(); apply(value); }}>
      <div class="reminder-datetime"><label class="field"><span>Дата</span><input type="date" aria-label="Дата напоминания" value={value.split('T')[0]} min={reminderDateTime(now).slice(0,10)} onInput={input => setValue(`${input.currentTarget.value}T${value.split('T')[1] || '09:00'}`)} required/></label><label class="field"><span>Время · МСК</span><TimeInput label="Время напоминания" value={value.split('T')[1] || ''} step="60" onChange={time => setValue(`${value.split('T')[0]}T${time}`)} required/></label></div>
      <div class="reminder-actions"><Button disabled={busy} onClick={() => apply(tomorrowReminder(now))}>Завтра в 09:00</Button><button type="submit" class="button primary" disabled={busy || Boolean(reminder && reminderDateTime(reminder.at) === value)}>{busy ? 'Сохраняем…' : reminder ? 'Сохранить' : 'Напомнить'}</button></div>
    </form>
    <p class="quiet-note">{pushReady ? 'Уведомления на устройстве можно включить ниже.' : 'Пока — только внутри приложения.'}</p>
    {pushReady && onEnablePush && <Button disabled={busy || enabled} onClick={async()=>{ setError('');setBusy(true);try {await onEnablePush();setEnabled(true);}catch(error){setError(error.message);}finally{setBusy(false);}}}>{enabled ? 'Уведомления включены' : 'Включить уведомления на устройстве'}</Button>}
    {error && <p class="background-error" role="alert">{error}</p>}
  </section>;
}
