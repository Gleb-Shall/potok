import { ActionMenu } from './ActionMenu.jsx';
import { RecordSummaryPreview } from './RecordSummaryPreview.jsx';
import { useState } from 'preact/hooks';
import { Modal, Field, Select, Button, FormFooter, ErrorMessage } from './UI.jsx';
import { RecordFields, RecordExtras } from './RecordFields.jsx';
import { LinkedText, LinkedValue } from './LinkedValue.jsx';
import { declaredRecordFields, recordTemplateUsesNameOnly } from '../lib/record-field-links.js';
import { RECORD_KINDS, allRecords, recordKinds, saveRecord } from '../lib/events.js';

export function RecordEditor({ data, original, category, onSave, onClose, onDelete }) {
  const [record, setRecord] = useState(() => structuredClone(original || { id: crypto.randomUUID(), kind: category || 'course', name: '', subtitle: '', contact: '', notes: '', color: 'blue', details: [] }));
  const [error, setError] = useState('');
  const change = (key, value) => setRecord(previous => ({ ...previous, [key]: value }));
  return <Modal title={original ? 'Редактор записи' : 'Новая запись'} subtitle="Постоянные сведения для связанных событий" onClose={onClose} wide className="product-dialog record-editor-dialog" panel>
    <form class="record-edit-form" onSubmit={event => { event.preventDefault(); try { onSave(saveRecord(data, record), 'Запись сохранена', record); } catch (error) { setError(error.message); } }}>
      <div class="record-edit-layout"><div class="record-edit-main"><Select label="Шаблон записи" value={record.kind} onChange={value=>change('kind',value)}>
        {[...new Set([record.kind,...recordKinds(data)])].filter(kind=>kind!=='student').map(kind=><option key={kind} value={kind}>{RECORD_KINDS[kind] || kind}</option>)}
      </Select>
      <Field label="Название или имя" value={record.name} onChange={value => change('name', value)} required maxLength="200"/>
      {!recordTemplateUsesNameOnly(data,record.kind) && <>
        <Field label="Короткое описание" value={record.subtitle} onChange={value => change('subtitle', value)} maxLength="300" placeholder="Например, курс 1 · СПбГУ"/>
        <Field label="Контакт или ссылка" value={record.contact} onChange={value => change('contact', value)} maxLength="500"/>
      </>}
      <RecordFields records={allRecords(data)} kind={record.kind} defined={declaredRecordFields(data,record.kind)} value={record.details} onChange={value => change('details', value)}/>
      <RecordExtras notes={record.notes} color={record.color} onNotes={value => change('notes', value)} onColor={value => change('color', value)}/></div><RecordSummaryPreview record={record}/></div><ErrorMessage error={error}/><FormFooter onClose={onClose}>{original && onDelete && <ActionMenu label="Ещё" items={[{id:'delete',icon:'trash',label:'Удалить запись',danger:true,onSelect:onDelete}]}/>}</FormFooter>
    </form>
  </Modal>;
}

export function RecordDetails({ record, onEdit, onEvent, onClose, onDelete }) {
  return <Modal title={record.name} subtitle={record.subtitle} onClose={onClose} className="product-dialog compact-dialog">
    {record.contact && <p class="notes-text"><LinkedText value={record.contact}/></p>}
    <dl class="detail-fields">{(record.details || []).map(item => <div key={item.id}><dt>{item.label}</dt><dd><LinkedValue field={item} value={item.value}/></dd></div>)}</dl>
    {record.notes && <p class="notes-text"><LinkedText value={record.notes}/></p>}
    <div class="modal-footer">{onDelete && <ActionMenu label="Ещё" items={[{id:'delete',icon:'trash',label:'Удалить запись',danger:true,onSelect:onDelete}]}/>}<Button onClick={onEdit}>Редактировать</Button><Button kind="primary" icon="plus" onClick={onEvent}>Создать событие</Button></div>
  </Modal>;
}
