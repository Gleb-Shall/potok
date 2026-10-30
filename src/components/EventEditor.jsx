import { useState } from 'preact/hooks';
import { Field, Select, Check, Colors, Modal, FormFooter, ErrorMessage, dateLabel } from './UI.jsx';
import { minutesToTime, timeToMinutes, todayISO } from '../lib/domain.js';
import { getType, getStudent, eventTitle, saveEvent } from '../lib/events.js';
import { Icon } from './Icon.jsx';

function CustomField({ field, value, onChange }) {
  if (field.type === 'checkbox') return <Check checked={value === true} onChange={onChange} required={field.required}>{field.label}{field.required && ' *'}</Check>;
  const props = { label: field.label + (field.required ? ' *' : ''), value: value ?? '', onChange, required: field.required };
  if (field.type === 'select') return <Select {...props}><option value="">Выбери значение</option>{field.options.map(option => <option key={option} value={option}>{option}</option>)}{value && !field.options.includes(value) && <option value={value}>{value} (сохранённое)</option>}</Select>;
  return <Field {...props} type={field.type} rows={field.type === 'textarea' ? 3 : undefined} maxLength={['text', 'textarea'].includes(field.type) ? 5000 : undefined} step={field.type === 'number' ? 'any' : undefined}/>;
}
export function EventEditor({ data, original, date, typeId, draft, onSave, onClose, onNewStudent }) {
  const currentSeries = original?.seriesId ? data.series.find(series => series.id === original.seriesId) : null;
  const [values, setValues] = useState(() => ({ typeId: original?.typeId || typeId || 'lesson', title: original?.title || '', studentId: original?.studentId || '', date: date || original?.date || todayISO(), start: minutesToTime(original?.start ?? 1020), duration: original?.duration || 60, notes: original?.notes || '', fields: { ...(original?.fields || {}) }, color: original?.color || getType(data, typeId || 'lesson').color, busy: original?.busy !== false, ...draft }));
  const [repeat, setRepeat] = useState(false);
  const [scope, setScope] = useState('one');
  const [weeks, setWeeks] = useState(currentSeries?.intervalWeeks || 1);
  const [until, setUntil] = useState(currentSeries?.until || '');
  const [error, setError] = useState('');
  const type = getType(data, values.typeId);
  const change = (key, value) => setValues(previous => ({ ...previous, [key]: value }));
  const changeType = id => { const next = getType(data, id); setValues(previous => ({ ...previous, typeId: id, color: next.color, studentId: next.linkStudent ? previous.studentId : '' })); };
  const chooseStudent = id => {
    const student = getStudent(data, id);
    setValues(previous => ({ ...previous, studentId: id, title: !previous.title || previous.title === getStudent(data, previous.studentId)?.name ? student?.name || previous.title : previous.title, color: student?.color || previous.color, fields: { ...previous.fields, ...(student && previous.typeId === 'lesson' && !previous.fields.rate ? { rate: student.rate } : {}) } }));
  };
  const submit = event => {
    event.preventDefault(); setError('');
    try {
      const input = { ...original, ...values, id: original?.id || 'new', start: timeToMinutes(values.start), duration: Number(values.duration), status: original?.status === 'done' ? 'done' : 'planned' };
      const recurrence = repeat || currentSeries && scope === 'future' ? { intervalWeeks: Number(weeks), until } : null;
      onSave(saveEvent(data, { values: input, original, scope, repeat: recurrence }), 'Событие сохранено', input.date);
    } catch (error) { setError(error.message); }
  };
  return <Modal title={original ? 'Редактор события' : 'Новое событие'} eyebrow="ТВОЁ РАСПИСАНИЕ" subtitle={original?.date ? `Сейчас: ${dateLabel(original.date)} · ${minutesToTime(original.start)}` : 'Пара, урок, личные планы или собственный тип карточки.'} wide onClose={onClose}>
    <form onSubmit={submit}>
      <Select label="Тип события" value={values.typeId} onChange={changeType}>{data.types.filter(item => !item.archived || item.id === original?.typeId).map(item => <option key={item.id} value={item.id}>{item.icon} {item.name}{item.archived ? ' (архив)' : ''}</option>)}</Select>
      {type.linkStudent && <div class="student-select-row"><Select label={`Ученик${type.requireStudent ? ' *' : ' (необязательно)'}`} value={values.studentId} onChange={chooseStudent} required={type.requireStudent}><option value="">Выбери ученика</option>{data.students.map(student => <option key={student.id} value={student.id}>{student.name}</option>)}</Select><ButtonNewStudent onClick={() => onNewStudent(values)}/></div>}
      <Field label={type.titleLabel || 'Название события'} value={values.title} onChange={value => change('title', value)} required maxLength={200} placeholder={values.typeId === 'class' ? 'Математический анализ' : 'Название события'}/>
      <div class="form-row"><Field label="Дата" type="date" value={values.date} onChange={value => change('date', value)} required/><Field label="Начало" type="time" value={values.start} onChange={value => change('start', value)} required/><Field label="Длительность, мин" type="number" value={values.duration} onChange={value => change('duration', value)} required min="5" max="1440" step="5"/></div>
      {currentSeries && <Select label="Какие события изменить" value={scope} onChange={setScope}><option value="one">Только это событие</option><option value="future">Это и последующие по расписанию</option></Select>}
      {!currentSeries && <Check checked={repeat} onChange={setRepeat}>Повторять событие</Check>}
      {(repeat || currentSeries && scope === 'future') && <div class="recurrence-box"><div class="form-row"><Field label="Каждые, недель" type="number" value={weeks} onChange={setWeeks} min="1" max="12" required/><Field label="Последний день повторов" type="date" value={until} onChange={setUntil}/></div><small>Каждые 2 недели — удобно для чередующихся университетских пар. Пустая дата окончания — без ограничения.</small></div>}
      {currentSeries && scope === 'one' && <div class="form-info"><Icon name="info"/><span>Изменится только выбранное событие. Остальное расписание останется прежним.</span></div>}
      {type.fields.some(field => !field.archived) && <div class="custom-fields-section"><h3>{type.name}: дополнительные поля</h3>{type.fields.filter(field => !field.archived).map(field => <CustomField key={`${type.id}:${field.id}`} field={field} value={values.fields[field.id]} onChange={value => setValues(previous => ({ ...previous, fields: { ...previous.fields, [field.id]: field.type === 'number' && value !== '' ? Number(value) : value } }))}/>)}</div>}
      <Colors value={values.color} onChange={value => change('color', value)}/>
      <Check checked={values.busy} onChange={value => change('busy', value)}>Занимает время — предупреждать о пересечениях</Check>
      <Field label="Заметки" type="textarea" rows="3" value={values.notes} onChange={value => change('notes', value)} maxLength={5000}/>
      <ErrorMessage error={error}/><FormFooter onClose={onClose} label={original ? 'Сохранить изменения' : 'Добавить событие'}/>
    </form>
  </Modal>;
}
function ButtonNewStudent({ onClick }) { return <button type="button" class="icon-button" onClick={onClick} aria-label="Добавить ученика"><Icon name="plus"/></button>; }
