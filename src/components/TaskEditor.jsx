import { useMemo, useState } from 'preact/hooks';
import { Button, ErrorMessage, Field, FormFooter, Modal, Select, dateLabel } from './UI.jsx';
import { minutesToTime } from '../lib/domain.js';
import { eventTitle, findOccurrence, projectWeek } from '../lib/events.js';
import { saveTask } from '../lib/tasks.js';
import { eventAlertDeadline } from '../lib/reminder-model.js';

const recordId = event => event?.recordId || event?.studentId;

export function TaskEditor({ data, task, source, today, now, onSave, onClose }) {
  const initial = findOccurrence(data, task?.eventId) || source;
  const [title, setTitle] = useState(task?.title || '');
  const [eventId, setEventId] = useState(task?.eventId ?? source?.id ?? '');
  const [date, setDate] = useState(initial?.date || today);
  const [error, setError] = useState('');
  const events = useMemo(()=>{
    if (!date) return [];
    try { return projectWeek(data, date, 1).events; } catch { return []; }
  }, [data, date]);
  const linked = findOccurrence(data, eventId);
  const choices = linked && !events.some(event=>event.id === linked.id) ? [linked, ...events] : events;
  const next = useMemo(()=>{
    if (!source || !recordId(source)) return;
    const after = source.date > today ? source.date : today;
    return projectWeek(data, after, 91).events.find(event => event.id !== source.id && event.status === 'planned' && eventAlertDeadline(event) > now &&
      recordId(event) === recordId(source) && (!source.date || event.date > source.date || event.start > source.start));
  }, [data, source, today, now]);

  return <Modal title={task ? 'Редактировать стикер' : 'Новый стикер'} onClose={onClose} className="product-dialog compact-dialog task-dialog">
    <form class="task-form" onSubmit={async event=>{
      event.preventDefault();
      setError('');
      try { await onSave(saveTask(data, { id:task?.id, title, eventId }), 'Задача сохранена'); }
      catch (failure) { setError(failure.message); }
    }}>
      <textarea class="task-note-input" aria-label="Текст стикера" placeholder="Заметка" rows={3}
        value={title} onInput={event=>setTitle(event.currentTarget.value)} required maxLength={200}/>
      <div class="task-link-fields">
        <Field label="Дата события" type="date" value={date} onChange={setDate}/>
        <Select label="Связанное событие" value={eventId} onChange={setEventId}>
          <option value="">Без события</option>
          {eventId && !linked && <option value={eventId}>Событие недоступно</option>}
          {choices.map(event=><option key={event.id} value={event.id}>{eventTitle(data,event)} · {event.date ? `${dateLabel(event.date)}, ${minutesToTime(event.start)}` : 'ждёт переноса'}</option>)}
        </Select>
      </div>
      {next && next.id !== eventId && <Button kind="text-button" onClick={()=>{ setDate(next.date); setEventId(next.id); }}>К следующему событию с этой записью</Button>}
      <ErrorMessage error={error}/>
      <FormFooter onClose={onClose}/>
    </form>
  </Modal>;
}
