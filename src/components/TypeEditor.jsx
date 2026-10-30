import { useState } from 'preact/hooks';
import { Modal, Field, Select, Check, Colors, Button, FormFooter, ErrorMessage } from './UI.jsx';
import { EventCard } from './EventCard.jsx';
import { FIELD_TYPES, saveType, RECORD_KINDS, recordKind } from '../lib/events.js';
import { todayISO } from '../lib/domain.js';

export function TypeEditor({ data, original, onSave, onClose, onDelete }) {
  const [type, setType] = useState(() => structuredClone(original ? { ...original, recordKind: recordKind(original), requireRecord: original.requireRecord ?? original.requireStudent, enableLocation: original.enableLocation !== false } : { id: crypto.randomUUID(), name: '', titleLabel: 'Название события', icon: '◇', color: 'peach', recordKind: '', requireRecord: false, enableLocation: true, fields: [], archived: false }));
  const [compactPreview, setCompactPreview] = useState(false);
  const [error, setError] = useState('');
  const change = (key, value) => setType(previous => ({ ...previous, [key]: value }));
  const updateField = (id, change) => setType(previous => ({ ...previous, fields: previous.fields.map(field => field.id === id ? { ...field, ...change } : field) }));
  const addField = () => setType(previous => ({ ...previous, fields: [...previous.fields, { id: crypto.randomUUID(), label: '', type: 'text', required: false, showOnCard: true, archived: false, options: [] }] }));
  const reorder = (id, direction) => setType(previous => {
    const fields = [...previous.fields]; const index = fields.findIndex(field => field.id === id); const target = index + direction;
    if (target >= 0 && target < fields.length) [fields[index], fields[target]] = [fields[target], fields[index]];
    return { ...previous, fields };
  });
  const used = field => [...data.events, ...data.series].some(event => event.typeId === type.id && Object.hasOwn(event.fields || {}, field.id));
  const previewData = { ...data, types: [...data.types.filter(item => item.id !== type.id), { ...type, name: type.name || 'Мой тип' }] };
  const preview = { id: 'preview', typeId: type.id, title: type.titleLabel || 'Название события', color: type.color, date: todayISO(), start: 600, duration: 60, busy: true, status: 'planned', fields: Object.fromEntries(type.fields.map(field => [field.id, field.type === 'checkbox' ? true : field.type === 'number' ? 1500 : field.type === 'date' ? todayISO() : field.type === 'multiselect' ? field.options.slice(0, 2) : field.type === 'select' ? field.options[0] || 'Вариант' : field.type === 'url' ? 'https://example.com' : 'Пример значения'])) };
  const submit = event => {
    event.preventDefault(); setError('');
    try {
      const input = { ...type, linkStudent: type.recordKind === 'student', requireStudent: type.recordKind === 'student' && type.requireRecord, requireRecord: Boolean(type.recordKind && type.requireRecord), fields: type.fields.map(field => ({ ...field, label: field.label.trim(), options: [...new Set(field.options.map(value => value.trim()).filter(Boolean))] })) };
      onSave(saveType(data, input), 'Шаблон карточки сохранён');
    } catch (error) { setError(error.message); }
  };
  return <Modal title={original ? 'Редактор типа карточки' : 'Свой тип события'} eyebrow="КОНСТРУКТОР КАРТОЧЕК" subtitle="Выбери поля, порядок и то, что видно прямо в расписании." wide onClose={onClose}>
    <form onSubmit={submit} class="type-builder-form"><div class="builder-layout"><div class="builder-main">
      <div class="template-basics"><Field label="Название типа" value={type.name} onChange={value => change('name', value)} required maxLength="80" placeholder="Например, Тренировка"/><Select label="Значок" value={type.icon} onChange={value => change('icon', value)}>{['◇', '✎', '▤', '◷', '✦', '●', '♧', '⌂'].map(icon => <option key={icon}>{icon}</option>)}</Select></div>
      <Field label="Как назвать основное поле" value={type.titleLabel} onChange={value => change('titleLabel', value)} required maxLength="80" placeholder="Например, Предмет или Название встречи"/>
      <Colors value={type.color} onChange={value => change('color', value)}/>
      <Select label="Связь с общей записью" value={type.recordKind} onChange={value => change('recordKind', value)}><option value="">Без связи</option><option value="any">Любая запись</option>{[...new Set([...Object.keys(RECORD_KINDS), ...(data.records || []).map(item => item.kind)])].map(kind => <option key={kind} value={kind}>{RECORD_KINDS[kind] || kind}</option>)}</Select>
      {type.recordKind && <Check checked={type.requireRecord} onChange={value => change('requireRecord', value)}>Связанная запись обязательна</Check>}
      <Check checked={type.enableLocation} onChange={value => change('enableLocation', value)}>Можно выбрать место на карте</Check>
      <div class="builder-heading"><h3>Дополнительные поля</h3><Button icon="plus" onClick={addField}>Добавить поле</Button></div>
      <p class="quiet-note">Название, дата, время, повторения и переносы есть у всех событий. Ниже — твои дополнительные поля.</p>
      <div class="builder-fields">{type.fields.map((field, index) => <section key={field.id} class={`builder-field ${field.archived ? 'field-archived' : ''}`}>
        <div class="builder-field-header"><span>Поле {index + 1}{field.archived ? ' · скрыто' : ''}</span><div><button type="button" class="icon-button" aria-label={`Поднять поле ${index + 1}`} disabled={index === 0} onClick={() => reorder(field.id, -1)}>↑</button><button type="button" class="icon-button" aria-label={`Опустить поле ${index + 1}`} disabled={index === type.fields.length - 1} onClick={() => reorder(field.id, 1)}>↓</button><button type="button" class="text-button" onClick={() => updateField(field.id, { archived: !field.archived, required: false })}>{field.archived ? 'Вернуть' : 'Скрыть'}</button></div></div>
        <div class="form-row"><Field label="Название поля" value={field.label} onChange={value => updateField(field.id, { label: value })} required maxLength="100"/><Select label="Формат" value={field.type} onChange={value => updateField(field.id, { type: value, ...(value === 'url' && field.showCompact == null ? { showCompact: true } : {}) })} disabled={used(field)}>{Object.entries(FIELD_TYPES).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</Select></div>
        {['select', 'multiselect'].includes(field.type) && <div class="option-editor"><span>Варианты ответа</span>{field.options.map((option, optionIndex) => <div class="option-row" key={optionIndex}><input aria-label={`Вариант ${optionIndex + 1} поля ${field.label || index + 1}`} value={option} maxLength="200" placeholder={`Вариант ${optionIndex + 1}`} onInput={event => updateField(field.id, { options: field.options.map((value, i) => i === optionIndex ? event.currentTarget.value : value) })}/><button type="button" class="icon-button" aria-label={`Убрать вариант ${optionIndex + 1}`} onClick={() => updateField(field.id, { options: field.options.filter((_, i) => i !== optionIndex) })}>×</button></div>)}<Button icon="plus" onClick={() => updateField(field.id, { options: [...field.options, ''] })}>Добавить вариант</Button><p class="quiet-note">{field.type === 'multiselect' ? 'В событии можно отметить несколько вариантов.' : 'В событии выбирается один вариант.'} Ранее выбранные значения сохранятся, даже если убрать вариант.</p></div>}
        {!field.archived && <div class="field-flags"><Check checked={field.required} onChange={value => updateField(field.id, { required: value })}>Обязательное</Check><Check checked={field.showCompact ?? (field.type === 'url' && field.showOnCard !== false)} onChange={value => updateField(field.id, { showCompact: value })}>В свёрнутой карточке</Check><Check checked={field.showOnCard} onChange={value => updateField(field.id, { showOnCard: value })}>В развёрнутой карточке</Check></div>}
        {used(field) && <small class="quiet-note">Формат поля зафиксирован: в событиях уже есть значения. Можно переименовать или скрыть поле — данные сохранятся.</small>}
      </section>)}</div>
      </div><aside class="template-preview"><span class="section-caption">ПРИМЕР КАРТОЧКИ</span><div class="preview-mode-switch"><Button onClick={() => setCompactPreview(true)} aria-pressed={compactPreview}>Свёрнутая</Button><Button onClick={() => setCompactPreview(false)} aria-pressed={!compactPreview}>Развёрнутая</Button></div><EventCard event={preview} data={previewData} preview expanded={!compactPreview}/></aside></div>
      <ErrorMessage error={error}/><FormFooter onClose={onClose} label="Сохранить шаблон">{data.types.some(item => item.id === original?.id) && onDelete && <Button icon="trash" kind="text-button danger-text delete-action" onClick={onDelete}>Удалить шаблон</Button>}</FormFooter>
    </form>
  </Modal>;
}
