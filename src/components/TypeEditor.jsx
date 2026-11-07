import { Icon } from './Icon.jsx';
import { ActionMenu } from './ActionMenu.jsx';
import { useState } from 'preact/hooks';
import { Modal, Field, Select, Check, Button, FormFooter, ErrorMessage } from './UI.jsx';
import { FIELD_TYPES, saveType, RECORD_KINDS, recordKind } from '../lib/events.js';

export function TypeEditor({ data, original, onSave, onClose, onDelete }) {
  const [type, setType] = useState(() => structuredClone(original ? { ...original, recordKind: recordKind(original), requireRecord: original.requireRecord ?? original.requireStudent, enableLocation: original.enableLocation !== false } : { id: crypto.randomUUID(), name: '', titleLabel: 'Название события', icon: '◇', color: 'peach', recordKind: '', requireRecord: false, enableLocation: true, fields: [], archived: false }));
  const [activeField, setActiveField] = useState(original?.fields?.[0]?.id || '');
  const [basicsOpen, setBasicsOpen] = useState(!original);
  const [error, setError] = useState('');
  const change = (key, value) => setType(previous => ({ ...previous, [key]: value }));
  const updateField = (id, change) => setType(previous => ({ ...previous, fields: previous.fields.map(field => field.id === id ? { ...field, ...change } : field) }));
  const addField = () => {
    const id = crypto.randomUUID();
    setType(previous => ({ ...previous, fields: [...previous.fields, { id, label: '', type: 'text', required: false, showOnCard: true, archived: false, options: [] }] }));
    setActiveField(id);
  };
  const reorder = (id, direction) => setType(previous => {
    const fields = [...previous.fields]; const index = fields.findIndex(field => field.id === id); const target = index + direction;
    if (target >= 0 && target < fields.length) [fields[index], fields[target]] = [fields[target], fields[index]];
    return { ...previous, fields };
  });
  const used = field => [...data.events, ...data.series].some(event => event.typeId === type.id && Object.hasOwn(event.fields || {}, field.id));
  const submit = event => {
    event.preventDefault(); setError('');
    try {
      if (!type.titleLabel.trim()) throw new Error('Укажи название основного поля.');
      const input = { ...type, linkStudent: type.recordKind === 'student', requireStudent: type.recordKind === 'student' && type.requireRecord, requireRecord: Boolean(type.recordKind && type.requireRecord), fields: type.fields.map(field => ({ ...field, label: field.label.trim(), options: [...new Set(field.options.map(value => value.trim()).filter(Boolean))] })) };
      onSave(saveType(data, input), 'Шаблон карточки сохранён');
    } catch (error) {
      setError(error.message);
      if (!type.name.trim() || !type.titleLabel.trim()) setBasicsOpen(true);
      else { const field = type.fields.find(field => !field.label.trim() || !field.archived && ['select','multiselect'].includes(field.type) && !field.options.some(value => value.trim())); if (field) setActiveField(field.id); }
    }
  };
  return <Modal title={original ? 'Шаблон события' : 'Новый шаблон'} subtitle="Поля, форматы и правила заполнения" wide onClose={onClose} className="product-dialog template-editor-dialog" panel>
    <form onSubmit={submit} class="type-builder-form" noValidate><div class="builder-main"><details class="builder-settings" open={basicsOpen} onToggle={event => setBasicsOpen(event.currentTarget.open)}><summary><span>Общие настройки</span><small>{type.name || 'Название, связи и место'}</small><Icon name="down"/></summary><div class="builder-settings-body">
      <Field label="Название типа" value={type.name} onChange={value => change('name', value)} required maxLength="80" placeholder="Например, Тренировка"/>
      <Field label="Как назвать основное поле" value={type.titleLabel} onChange={value => change('titleLabel', value)} required maxLength="80" placeholder="Например, Предмет или Название встречи"/>
      <Select label="Связь с общей записью" value={type.recordKind} onChange={value => change('recordKind', value)}><option value="">Без связи</option><option value="any">Любая запись</option>{[...new Set([...Object.keys(RECORD_KINDS), ...(data.records || []).map(item => item.kind)])].map(kind => <option key={kind} value={kind}>{RECORD_KINDS[kind] || kind}</option>)}</Select>
      {type.recordKind && <Check checked={type.requireRecord} onChange={value => change('requireRecord', value)}>Связанная запись обязательна</Check>}
      <Check checked={type.enableLocation} onChange={value => change('enableLocation', value)}>Можно выбрать место на карте</Check>
      </div></details><div class="builder-heading"><h3>Дополнительные поля</h3><Button icon="plus" onClick={addField}>Добавить поле</Button></div>
      {type.fields.length === 0 && <p class="builder-empty">Название, дата и время уже есть. Добавь поля для своих событий.</p>}
      <div class="builder-fields">{type.fields.map((field, index) => <details key={field.id} class={`builder-field ${field.archived ? 'field-archived' : ''}`} open={activeField === field.id} onToggle={event => { if (event.currentTarget.open) setActiveField(field.id); else if (activeField === field.id) setActiveField(''); }}><summary class="builder-field-summary"><Icon name={field.type === 'url' ? 'external' : field.type === 'checkbox' ? 'check' : 'sliders'}/><strong>{field.label || 'Новое поле'}</strong><small>{field.archived ? 'Скрыто' : FIELD_TYPES[field.type]}</small><Icon name="down"/></summary><div class="builder-field-body">
        <div class="builder-field-header"><span>Настройки поля</span><div><button type="button" class="icon-button" aria-label={`Поднять поле ${index + 1}`} disabled={index === 0} onClick={() => reorder(field.id, -1)}>↑</button><button type="button" class="icon-button" aria-label={`Опустить поле ${index + 1}`} disabled={index === type.fields.length - 1} onClick={() => reorder(field.id, 1)}>↓</button><button type="button" class="text-button" onClick={() => updateField(field.id, { archived: !field.archived, required: false })}>{field.archived ? 'Вернуть' : 'Скрыть'}</button></div></div>
        <div class="form-row"><Field label="Название поля" value={field.label} onChange={value => updateField(field.id, { label: value })} required maxLength="100"/><Select label="Формат" value={field.type} onChange={value => updateField(field.id, { type: value, ...(value === 'url' && field.showCompact == null ? { showCompact: true } : {}) })} disabled={used(field)}>{Object.entries(FIELD_TYPES).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</Select></div>
        {['select', 'multiselect'].includes(field.type) && <div class="option-editor"><span>Варианты ответа</span>{field.options.map((option, optionIndex) => <div class="option-row" key={optionIndex}><input aria-label={`Вариант ${optionIndex + 1} поля ${field.label || index + 1}`} value={option} maxLength="200" placeholder={`Вариант ${optionIndex + 1}`} onInput={event => updateField(field.id, { options: field.options.map((value, i) => i === optionIndex ? event.currentTarget.value : value) })}/><button type="button" class="icon-button" aria-label={`Убрать вариант ${optionIndex + 1}`} onClick={() => updateField(field.id, { options: field.options.filter((_, i) => i !== optionIndex) })}>×</button></div>)}<Button icon="plus" onClick={() => updateField(field.id, { options: [...field.options, ''] })}>Добавить вариант</Button><p class="quiet-note">{field.type === 'multiselect' ? 'В событии можно отметить несколько вариантов.' : 'В событии выбирается один вариант.'} Ранее выбранные значения сохранятся, даже если убрать вариант.</p></div>}
        {!field.archived && <Check checked={field.required} onChange={value => updateField(field.id, { required: value })}>Обязательное</Check>}
        {used(field) && <small class="quiet-note">Формат поля зафиксирован: в событиях уже есть значения. Можно переименовать или скрыть поле — данные сохранятся.</small>}
      </div></details>)}</div>
      </div>
      <ErrorMessage error={error}/><FormFooter onClose={onClose} label="Сохранить шаблон">{data.types.some(item => item.id === original?.id) && onDelete && <ActionMenu label="Ещё" items={[{id:'delete',icon:'trash',label:'Удалить шаблон',danger:true,onSelect:onDelete}]}/>}</FormFooter>
    </form>
  </Modal>;
}
