import { useState } from 'preact/hooks';
import { Modal, Field, Button, ErrorMessage } from './UI.jsx';
import { todayISO } from '../lib/domain.js';
import { stopSeries } from '../lib/event-history.js';

export function StopSeriesDialog({ data, event, onSave, onClose }) {
  const [cutoff, setCutoff] = useState(todayISO());
  const [error, setError] = useState('');
  return <Modal title="Завершить расписание повторов" subtitle="Прошлые события и отметки о проведении останутся в календаре и истории." onClose={onClose}>
    <form onSubmit={submit => { submit.preventDefault(); try { onSave(stopSeries(data, event, cutoff), 'Будущие повторы прекращены. История сохранена.'); } catch (error) { setError(error.message); } }}>
      <Field label="Не проводить начиная с" type="date" min={todayISO()} value={cutoff} onChange={setCutoff} required/>
      <p class="quiet-note">Начиная с выбранного дня будущие события этой серии, включая переносы, будут убраны. События, время которых уже прошло, и отмеченные проведёнными сохранятся. Отметка «Время прошло» сама по себе не подтверждает проведение.</p>
      <ErrorMessage error={error}/><div class="modal-footer"><Button onClick={onClose}>Оставить расписание</Button><button type="submit" class="button primary">Завершить повторы</button></div>
    </form>
  </Modal>;
}
