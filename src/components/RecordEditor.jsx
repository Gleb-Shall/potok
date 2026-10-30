import { useState } from 'preact/hooks';
import { Modal, Field, Colors, Button, FormFooter, ErrorMessage } from './UI.jsx';
import { RECORD_KINDS, saveRecord } from '../lib/events.js';

export function RecordEditor({ data, original, category, onSave, onClose, onDelete }) {
  const [record, setRecord] = useState(() => structuredClone(original || { id: crypto.randomUUID(), kind: category || 'course', name: '', subtitle: '', contact: '', notes: '', color: 'blue', details: [] }));
  const [error, setError] = useState('');
  const change = (key, value) => setRecord(previous => ({ ...previous, [key]: value }));
  return <Modal title={original ? 'Редактор записи' : 'Новая запись'} subtitle="Общие сведения хранятся здесь. Время и детали каждой встречи — в событии." onClose={onClose}>
    <form onSubmit={event => { event.preventDefault(); try { onSave(saveRecord(data, record), 'Запись сохранена', record); } catch (error) { setError(error.message); } }}>
      <Field label="Категория" value={RECORD_KINDS[record.kind] || record.kind} onChange={value => change('kind', Object.keys(RECORD_KINDS).find(key => RECORD_KINDS[key] === value) || value)} required maxLength="80" list="record-categories"/>
      <datalist id="record-categories">{[...new Set([...Object.keys(RECORD_KINDS).filter(kind => kind !== 'student'), ...(data.records || []).map(item => item.kind)])].map(kind => <option key={kind} value={RECORD_KINDS[kind] || kind}/>)}</datalist>
      <Field label="Название или имя" value={record.name} onChange={value => change('name', value)} required maxLength="200"/>
      <Field label="Короткое описание" value={record.subtitle} onChange={value => change('subtitle', value)} maxLength="300" placeholder="Например, курс 1 · СПбГУ"/>
      <Field label="Контакт или ссылка" value={record.contact} onChange={value => change('contact', value)} maxLength="500"/>
      <section class="record-info-editor"><h3>Постоянные сведения</h3>{(record.details || []).map((item, index) => <div class="option-row" key={item.id}>
        <Field label="Поле" value={item.label} maxLength="100" onChange={value => change('details', record.details.map((row, i) => i === index ? { ...row, label: value } : row))}/>
        <Field label="Значение" value={item.value} maxLength="1000" onChange={value => change('details', record.details.map((row, i) => i === index ? { ...row, value } : row))}/>
        <button type="button" class="icon-button" aria-label="Убрать сведение" onClick={() => change('details', record.details.filter((_, i) => i !== index))}>×</button>
      </div>)}<Button icon="plus" onClick={() => change('details', [...(record.details || []), { id: crypto.randomUUID(), label: '', value: '' }])}>Добавить сведение</Button></section>
      <Field label="Заметки" type="textarea" rows="3" value={record.notes} onChange={value => change('notes', value)} maxLength="5000"/>
      <Colors value={record.color} onChange={value => change('color', value)}/><ErrorMessage error={error}/><FormFooter onClose={onClose}>{original && onDelete && <Button icon="trash" kind="text-button danger-text delete-action" onClick={onDelete}>Удалить запись</Button>}</FormFooter>
    </form>
  </Modal>;
}

export function RecordDetails({ record, onEdit, onEvent, onClose, onDelete }) {
  return <Modal title={record.name} eyebrow={RECORD_KINDS[record.kind] || record.kind} subtitle={record.subtitle} onClose={onClose}>
    {record.contact && <p class="notes-text">{record.contact}</p>}
    <dl class="detail-fields">{(record.details || []).map(item => <div key={item.id}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}</dl>
    {record.notes && <p class="notes-text">{record.notes}</p>}
    <div class="modal-footer">{onDelete && <Button icon="trash" kind="text-button danger-text delete-action" onClick={onDelete}>Удалить запись</Button>}<Button onClick={onEdit}>Редактировать</Button><Button kind="primary" icon="plus" onClick={onEvent}>Создать событие</Button></div>
  </Modal>;
}
