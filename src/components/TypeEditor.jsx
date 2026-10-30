import { useState } from 'preact/hooks';
import { Modal, Field, Select, Check, Colors, Button, FormFooter, ErrorMessage } from './UI.jsx';
import { EventCard } from './EventCard.jsx';
import { FIELD_TYPES, saveType } from '../lib/events.js';
import { todayISO } from '../lib/domain.js';

export function TypeEditor({ data, original, onSave, onClose }) {
  const [type, setType] = useState(() => structuredClone(original || { id: crypto.randomUUID(), name: '', titleLabel: 'Название события', icon: '◇', color: 'peach', linkStudent: false, requireStudent: false, fields: [], archived: false }));
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
  const preview = { id: 'preview', typeId: type.id, title: type.titleLabel || 'Название события', color: type.color, date: todayISO(), start: 600, duration: 60, busy: true, status: 'planned', fields: Object.fromEntries(type.fields.map(field => [field.id, field.type === 'checkbox' ? true : field.type === 'number' ? 1500 : field.type === 'date' ? todayISO() : field.type === 'select' ? field.optionsText?.split(',')[0] || field.options[0] || 'Вариант' : 'Пример значения'])) };
  const submit = event => {
    event.preventDefault(); setError('');
    try {
      const input = { ...type, requireStudent: type.linkStudent && type.requireStudent, fields: type.fields.map(({ optionsText, ...field }) => ({ ...field, label: field.label.trim(), options: optionsText === undefined ? field.options : [...new Set(optionsText.split(',').map(value => value.trim()).filter(Boolean))] })) };
      onSave(saveType(data, input), 'Шаблон карточки сохранён');
    } catch (error) { setError(error.message); }
  };
  return <Modal title={original ? 'Редактор типа карточки' : 'Свой тип события'} eyebrow="КОНСТРУКТОР КАРТОЧЕК" subtitle="Выбери поля, порядок и то, что видно прямо в расписании." wide onClose={onClose}>
    <form onSubmit={submit}>
      <div class="template-basics"><Field label="Название типа" value={type.name} onChange={value => change('name', value)} required maxLength="80" placeholder="Например, Тренировка"/><Select label="Значок" value={type.icon} onChange={value => change('icon', value)}>{['◇', '✎', '▤', '◷', '✦', '●', '♧', '⌂'].map(icon => <option key={icon}>{icon}</option>)}</Select></div>
      <Field label="Как назвать основное поле" value={type.titleLabel} onChange={value => change('titleLabel', value)} required maxLength="80" placeholder="Например, Предмет или Название встречи"/>
      <Colors value={type.color} onChange={value => change('color', value)}/>
      <Check checked={type.linkStudent} onChange={value => change('linkStudent', value)}>Можно связать с карточкой ученика</Check>
      {type.linkStudent && <Check checked={type.requireStudent} onChange={value => change('requireStudent', value)}>Ученик обязателен для этого типа</Check>}
      <div class="builder-heading"><h3>Дополнительные поля</h3><Button icon="plus" onClick={addField}>Добавить поле</Button></div>
      <p class="quiet-note">Название, дата, время, повторения и переносы есть у всех событий. Ниже — твои дополнительные поля.</p>
      <div class="builder-fields">{type.fields.map((field, index) => <section key={field.id} class={`builder-field ${field.archived ? 'field-archived' : ''}`}>
        <div class="builder-field-header"><span>Поле {index + 1}{field.archived ? ' · скрыто' : ''}</span><div><button type="button" class="icon-button" aria-label={`Поднять поле ${index + 1}`} disabled={index === 0} onClick={() => reorder(field.id, -1)}>↑</button><button type="button" class="icon-button" aria-label={`Опустить поле ${index + 1}`} disabled={index === type.fields.length - 1} onClick={() => reorder(field.id, 1)}>↓</button><button type="button" class="text-button" onClick={() => updateField(field.id, { archived: !field.archived, required: false })}>{field.archived ? 'Вернуть' : 'Скрыть'}</button></div></div>
        <div class="form-row"><Field label="Название поля" value={field.label} onChange={value => updateField(field.id, { label: value })} required maxLength="100"/><Select label="Формат" value={field.type} onChange={value => updateField(field.id, { type: value })} disabled={used(field)}>{Object.entries(FIELD_TYPES).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</Select></div>
        {field.type === 'select' && <Field label="Варианты через запятую" value={field.optionsText ?? field.options.join(', ')} onChange={value => updateField(field.id, { optionsText: value })} placeholder="Лекция, Семинар, Практика"/>}
        {!field.archived && <div class="field-flags"><Check checked={field.required} onChange={value => updateField(field.id, { required: value })}>Обязательное</Check><Check checked={field.showOnCard} onChange={value => updateField(field.id, { showOnCard: value })}>Показывать на карточке</Check></div>}
        {used(field) && <small class="quiet-note">Формат поля зафиксирован: в событиях уже есть значения. Можно переименовать или скрыть поле — данные сохранятся.</small>}
      </section>)}</div>
      <section class="template-preview"><span class="section-caption">ПРИМЕР КАРТОЧКИ</span><EventCard event={preview} data={previewData} preview/></section>
      <ErrorMessage error={error}/><FormFooter onClose={onClose} label="Сохранить тип"/>
    </form>
  </Modal>;
}
