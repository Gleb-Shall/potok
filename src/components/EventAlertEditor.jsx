import { useState } from 'preact/hooks';
import { Button, ErrorMessage, Field, Modal, Select } from './UI.jsx';
import { TimeInput } from './TimeInput.jsx';
import { eventTitle } from '../lib/events.js';
import { eventAlertDeadline } from '../lib/reminder-model.js';
import { reminderDateTime, saveEventAlert } from '../lib/reminders.js';

export function EventAlertEditor({ data, event, alert, now, onSave, onClose, onEnablePush, alarmDevice, onAuthorizeAlarm }) {
  const [title, setTitle] = useState(alert?.title || `Поток · ${eventTitle(data, event)}`.slice(0, 200));
  const [value, setValue] = useState(()=>reminderDateTime(alert?.at || Math.max(now + 60000, eventAlertDeadline(event) - 15 * 60000)));
  const [error, setError] = useState('');
  const [enabling, setEnabling] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [method, setMethod] = useState(()=>alert ? (alert.alarmDevice ? 'alarm' : 'reminder') : alarmDevice ? 'alarm' : 'reminder');
  const [saving, setSaving] = useState(false);
  const isAlarm = method === 'alarm';
  const targetDevice = isAlarm ? (alert?.alarmDevice || alarmDevice) : undefined;
  const [date, time] = value.split('T');
  const enable = async () => {
    setError('');
    setEnabling(true);
    try { await onEnablePush(); setEnabled(true); }
    catch (failure) { setError(failure.message); }
    finally { setEnabling(false); }
  };
  const formTitle = isAlarm ? (alert ? 'Изменить будильник' : 'Поставить будильник') : (alert ? 'Изменить напоминание' : 'Напомнить о событии');
  return <Modal title={formTitle} subtitle={eventTitle(data,event)}
    className="reminder-dialog" onClose={onClose}>
    <form onSubmit={async input=>{
      input.preventDefault();
      if (saving) return;
      setError('');
      setSaving(true);
      try {
        if (isAlarm && !targetDevice) throw new Error('Для этого будильника нужен iPhone с iOS 26 или новее.');
        const next = saveEventAlert(data,event.id,{id:alert?.id,title,value,alarmDevice:targetDevice},Math.max(now,Date.now()));
        if (isAlarm && targetDevice === alarmDevice) await onAuthorizeAlarm();
        await onSave(next, isAlarm ? 'Время будильника сохранено' : 'Напоминание сохранено');
      } catch (failure) { setError(typeof failure === 'string' ? failure : failure.message); }
      finally { setSaving(false); }
    }}>
      {alarmDevice && !alert && <Select label="Способ напоминания" value={method} onChange={setMethod}>
        <option value="alarm">Будильник на этом iPhone</option>
        <option value="reminder">Напоминание в приложении</option>
      </Select>}
      <Field label={isAlarm ? 'Название будильника' : 'Название уведомления'} value={title} onChange={setTitle} maxLength={200} required/>
      <div class="reminder-datetime">
        <Field label="Дата" type="date" value={date} onChange={next=>setValue(`${next}T${time}`)} required/>
        <Field label="Время · МСК"><TimeInput label="Время напоминания" value={time} step="60"
          onChange={next=>setValue(`${date}T${next}`)} required/></Field>
      </div>
      {isAlarm ? <p class="quiet-note">{targetDevice === alarmDevice ? 'Будильник сработает на этом iPhone.' : 'Будильник сработает на iPhone, где его создали, после синхронизации.'}</p>
        : onEnablePush ? <Button disabled={enabling || enabled} onClick={enable}>{enabled ? 'Уведомления включены' : 'Включить уведомления на устройстве'}</Button>
        : <p class="quiet-note">Напоминание появится в открытом «Потоке».</p>}
      <ErrorMessage error={error}/>
      <div class="modal-footer"><Button onClick={onClose}>Отмена</Button>
        <button type="submit" class="button primary" disabled={saving}>{saving ? 'Сохраняем…' : 'Сохранить'}</button></div>
    </form>
  </Modal>;
}
