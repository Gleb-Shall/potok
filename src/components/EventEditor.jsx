import { useState } from 'preact/hooks';
import { Field, Select, Check, Colors, Modal, Button, FormFooter, ErrorMessage, dateLabel } from './UI.jsx';
import { minutesToTime, timeToMinutes, todayISO } from '../lib/domain.js';
import { getType, saveEvent, allRecords, recordKind, RECORD_KINDS } from '../lib/events.js';
import { Icon } from './Icon.jsx';
import { eventEnd, updateTiming } from '../lib/timing.js';
import { TimingFields } from './TimingFields.jsx';
import { LocationField } from './LocationField.jsx';

function CustomField({ field, value, onChange }) {
  if (field.type === 'checkbox') return <Check checked={value === true} onChange={onChange} required={field.required}>{field.label}{field.required && ' *'}</Check>;
  if (field.type === 'multiselect') {
    const selected = Array.isArray(value) ? value : [];
    return <fieldset class="multi-choice"><legend>{field.label}{field.required && ' *'}</legend><div>{[...new Set([...field.options, ...selected])].map(option => <label key={option} class={selected.includes(option) ? 'selected' : ''}><input type="checkbox" checked={selected.includes(option)} onChange={event => onChange(event.currentTarget.checked ? [...selected, option] : selected.filter(item => item !== option))}/><span>{option}{!field.options.includes(option) && ' (сохранённое)'}</span></label>)}</div></fieldset>;
  }
  const props = { label: field.label + (field.required ? ' *' : ''), value: value ?? '', onChange, required: field.required };
  if (field.type === 'select') return <Select {...props}><option value="">Выбери значение</option>{field.options.map(option => <option key={option} value={option}>{option}</option>)}{value && !field.options.includes(value) && <option value={value}>{value} (сохранённое)</option>}</Select>;
  return <Field {...props} type={field.type} rows={field.type === 'textarea' ? 3 : undefined} maxLength={['text', 'textarea'].includes(field.type) ? 5000 : undefined} step={field.type === 'number' ? 'any' : undefined}/>;
}

export function EventEditor({ data, original, date, typeId, draft, onSave, onClose, onNewStudent, onNewRecord, onDelete }) {
  const currentSeries = original?.seriesId ? data.series.find(series => series.id === original.seriesId) : null;
  const { editor, ...draftValues } = draft || {};
  const [values, setValues] = useState(() => { const initial = { typeId: original?.typeId || typeId || 'lesson', title: original?.title || '', studentId: original?.studentId || '', recordId: original?.recordId || original?.studentId || '', date: date || original?.date || todayISO(), start: minutesToTime(original?.start ?? 1020), duration: original?.duration || 60, notes: original?.notes || '', fields: { ...(original?.fields || {}) }, location: original?.location || null, color: original?.color || getType(data, typeId || 'lesson').color, busy: original?.busy !== false, recordDetached: original?.recordDetached || false, ...draftValues }; return { ...initial, end: initial.end ?? eventEnd(initial.start, initial.duration) }; });
  const [repeat, setRepeat] = useState(editor?.repeat || false);
  const [scope, setScope] = useState(editor?.scope || 'one');
  const [weeks, setWeeks] = useState(editor?.weeks || currentSeries?.intervalWeeks || 1);
  const [until, setUntil] = useState(editor?.until ?? currentSeries?.until ?? '');
  const [error, setError] = useState('');
  const type = getType(data, values.typeId);
  const kind = recordKind(type);
  const records = allRecords(data);
  const linked = records.find(item => item.id === values.recordId);
  const fields = type.fields.filter(field => !field.archived);
  const change = (key, value) => setValues(previous => ({ ...previous, [key]: value }));
  const timing = (key, value) => setValues(previous => ({ ...previous, ...updateTiming(previous, key, value) }));
  const requiredRecord = !values.recordDetached && (type.requireStudent || type.requireRecord);
  const changeType = id => {
    const next = getType(data, id); const nextKind = recordKind(next);
    const keep = linked && (nextKind === 'any' || nextKind === linked.kind);
    setValues(previous => ({ ...previous, typeId: id, color: next.color, recordDetached: false, recordId: keep ? previous.recordId : '', studentId: keep && linked.kind === 'student' ? linked.id : '' }));
  };
  const chooseRecord = id => {
    const record = records.find(item => item.id === id);
    setValues(previous => ({ ...previous, recordId: id, recordDetached: id ? false : previous.recordDetached, studentId: record?.kind === 'student' ? id : '', title: !previous.title || previous.title === linked?.name ? record?.name || '' : previous.title, color: record?.color || previous.color, fields: { ...previous.fields, ...(record?.kind === 'student' && previous.typeId === 'lesson' && previous.fields.rate == null ? { rate: record.rate } : {}) } }));
  };
  const newRecord = () => {
    const nextDraft = { ...values, editor: { repeat, scope, weeks, until } };
    if (kind === 'student') onNewStudent(nextDraft); else onNewRecord(kind === 'any' ? 'person' : kind, nextDraft);
  };
  const submit = event => {
    event.preventDefault(); setError('');
    try {
      const { end, ...eventValues } = values;
      const input = { ...original, ...eventValues, id: original?.id || 'new', start: timeToMinutes(values.start), duration: Number(values.duration), status: original?.status === 'done' ? 'done' : 'planned' };
      const recurrence = repeat || currentSeries && scope === 'future' ? { intervalWeeks: Number(weeks), until } : null;
      onSave(saveEvent(data, { values: input, original, scope, repeat: recurrence }), 'Событие сохранено', input.date);
    } catch (error) { setError(error.message); }
  };
  return <Modal title={original ? 'Редактор события' : 'Новое событие'} subtitle={original?.date ? `Сейчас: ${dateLabel(original.date)} · ${minutesToTime(original.start)}` : 'Начни с главного. Остальное можно добавить позже.'} wide onClose={onClose}>
    <form onSubmit={submit} class="event-form">
      <section class="editor-section"><Select label="Тип события" value={values.typeId} onChange={changeType}>{data.types.filter(item => !item.archived || item.id === original?.typeId).map(item => <option key={item.id} value={item.id}>{item.icon} {item.name}{item.archived ? ' (архив)' : ''}</option>)}</Select>
      {kind && <div class="student-select-row"><Select label={`${kind === 'any' ? 'Связанная запись' : RECORD_KINDS[kind] || kind}${requiredRecord ? ' *' : ' · необязательно'}`} value={values.recordId} onChange={chooseRecord} required={requiredRecord}><option value="">Выбери запись</option>{records.filter(item => kind === 'any' || item.kind === kind).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</Select><button type="button" class="icon-button" onClick={newRecord} aria-label="Создать связанную запись"><Icon name="plus"/></button></div>}
      {values.recordDetached && <p class="quiet-note">Связанная запись удалена. Это самостоятельное событие; при желании можно выбрать другую запись.</p>}
      {linked && <div class="linked-record-summary"><strong>{linked.name}</strong><span>{linked.subject || linked.subtitle || RECORD_KINDS[linked.kind] || linked.kind}</span>{linked.details?.length > 0 && <details><summary>Общие сведения</summary><dl>{linked.details.map(item => <div key={item.id}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}</dl></details>}</div>}
      <Field label={type.titleLabel || 'Название события'} value={values.title} onChange={value => change('title', value)} required maxLength={200} placeholder={values.typeId === 'class' ? 'Математический анализ' : 'Название события'}/>
      <div class="form-row time-fields"><Field label="Дата" type="date" value={values.date} onChange={value => change('date', value)} required/><TimingFields values={values} onChange={timing}/></div></section>
      <section class="editor-section recurrence-section">{currentSeries ? <Select label="Какие события изменить" value={scope} onChange={setScope}><option value="one">Только это событие</option><option value="future">Это и последующие по расписанию</option></Select> : <Check checked={repeat} onChange={setRepeat}>Повторять событие</Check>}
      {(repeat || currentSeries && scope === 'future') && <div class="recurrence-box"><div class="form-row"><Field label="Каждые, недель" type="number" value={weeks} onChange={setWeeks} min="1" max="12" required/><Field label="До даты · необязательно" type="date" value={until} onChange={setUntil}/></div><small>2 недели — для чередующихся пар. Без даты окончания — постоянно.</small></div>}</section>
      {fields.length > 0 && <details class="editor-disclosure" open={fields.some(field => field.required || values.fields[field.id] != null && values.fields[field.id] !== '')}><summary>Детали события <span>{fields.length} полей</span></summary><div class="editor-disclosure-body">{fields.map(field => <CustomField key={`${type.id}:${field.id}`} field={field} value={values.fields[field.id]} onChange={value => setValues(previous => ({ ...previous, fields: { ...previous.fields, [field.id]: field.type === 'number' && value !== '' ? Number(value) : value } }))}/>)}</div></details>}
      {(type.enableLocation !== false || values.location) && <LocationField value={values.location} onChange={value => change('location', value)} data={data}/>}
      <details class="editor-disclosure" open={Boolean(values.notes)}><summary>Заметки <span>для этого события</span></summary><div class="editor-disclosure-body"><Field label="Заметка" type="textarea" rows="3" value={values.notes} onChange={value => change('notes', value)} maxLength={5000}/></div></details>
      <details class="editor-disclosure"><summary>Оформление и занятость</summary><div class="editor-disclosure-body"><Colors value={values.color} onChange={value => change('color', value)}/><Check checked={values.busy} onChange={value => change('busy', value)}>Занимает время — предупреждать о пересечениях</Check></div></details>
      <ErrorMessage error={error}/><FormFooter onClose={onClose} label={original ? 'Сохранить изменения' : 'Добавить событие'}>{original && onDelete && <Button kind="text-button danger-text delete-action" icon="trash" onClick={onDelete}>Удалить событие</Button>}</FormFooter>
    </form>
  </Modal>;
}
