import { useState } from 'preact/hooks';
import { Modal, Field, Button, FormFooter, ErrorMessage, dateLabel } from './UI.jsx';
import { minutesToTime, timeToMinutes, todayISO } from '../lib/domain.js';
import { eventTitle, saveMove } from '../lib/events.js';

export function MoveEditor({ data, event, date, onSave, onAdvanced, onClose }) {
  const [target, setTarget] = useState(date || event.date || todayISO());
  const [time, setTime] = useState(minutesToTime(event.start));
  const [changeDay, setChangeDay] = useState(!date);
  const [error, setError] = useState('');
  return <Modal title="Перенести событие" subtitle={eventTitle(data, event)} onClose={onClose}>
    <form onSubmit={input => { input.preventDefault(); try { onSave(saveMove(data, event, target, timeToMinutes(time)), 'Событие перенесено', target); } catch (error) { setError(error.message); } }}>
      <div class="move-destination"><span>Новый день</span><strong>{dateLabel(target, { weekday: 'long' })}</strong><button class="text-button" type="button" onClick={() => setChangeDay(!changeDay)}>{changeDay ? 'Скрыть календарь' : 'Выбрать другой день'}</button></div>
      {changeDay && <Field label="Дата" type="date" value={target} onChange={setTarget} required/>}
      <Field label="Во сколько начать?" type="time" value={time} onChange={setTime} required autoFocus/>
      <p class="quiet-note">Длительность — {event.duration} мин. Переносится только это событие; обычное время остаётся в истории.</p>
      <Button kind="text-button" onClick={() => onAdvanced({ date: target, start: time })}>Расширенное редактирование →</Button>
      <ErrorMessage error={error}/><FormFooter onClose={onClose} label="Перенести"/>
    </form>
  </Modal>;
}
