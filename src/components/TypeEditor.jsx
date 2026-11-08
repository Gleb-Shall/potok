import { Icon } from './Icon.jsx';
import { ActionMenu } from './ActionMenu.jsx';
import { useState } from 'preact/hooks';
import { Modal, Field, Select, Check, Button, FormFooter, ErrorMessage } from './UI.jsx';
import { FieldOptionsEditor } from './FieldOptionsEditor.jsx';
import { isChoiceField, recordTypeFields } from '../lib/record-field-links.js';
import { FIELD_TYPES, saveType, RECORD_KINDS, recordKind, recordKinds } from '../lib/events.js';

export function TypeEditor({ data, original, onSave, onClose, onDelete }) {
  const [type, setType] = useState(() => structuredClone(original ? { ...original, recordKind: recordKind(original), requireRecord: original.requireRecord ?? original.requireStudent, enableLocation: original.enableLocation !== false } : { id: crypto.randomUUID(), name: '', icon: '◇', color: 'peach', recordKind: '', requireRecord: false, enableLocation: true, fields: [], archived: false }));
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
  const sources = recordTypeFields(data,type.recordKind);
  const used = field => [...data.events, ...data.series].some(event => event.typeId === type.id && Object.hasOwn(event.fields || {}, field.id));
  const chooseSource = (field, id) => {
    const source = sources.find(item=>item.id===id);
    if (!source) {updateField(field.id,{source:null});return;}
    updateField(field.id,{
      source:{fieldId:source.id,mode:'live'},type:source.type,label:field.label || source.label,
      options:source.options || [],metric:source.type==='number' && field.metric,
      ...(source.type==='url' && field.showCompact==null ? {showCompact:true} : {}),
    });
  };
  const submit = event => {
    event.preventDefault(); setError('');
    try {
      const input = { ...type, linkStudent: type.recordKind === 'student', requireStudent: type.recordKind === 'student' && type.requireRecord, requireRecord: Boolean(type.recordKind && type.requireRecord), fields: type.fields.map(field => ({ ...field, label: field.label.trim(), options: [...new Set(field.options.map(value => value.trim()).filter(Boolean))] })) };
      onSave(saveType(data, input), 'Шаблон карточки сохранён');
    } catch (error) {
      setError(error.message);
      if (!type.name.trim()) setBasicsOpen(true);
      else { const field = type.fields.find(field => !field.label.trim() || !field.archived && ['select','multiselect'].includes(field.type) && !field.options.some(value => value.trim())); if (field) setActiveField(field.id); }
    }
  };
  return <Modal title={original ? 'Шаблон события' : 'Новый шаблон'} subtitle="Поля, форматы и правила заполнения" wide onClose={onClose} className="product-dialog template-editor-dialog" panel>
    <form onSubmit={submit} class="type-builder-form" noValidate><div class="builder-main"><details class="builder-settings" open={basicsOpen} onToggle={event => setBasicsOpen(event.currentTarget.open)}><summary><span>Общие настройки</span><small>{type.name || 'Название, связи и место'}</small><Icon name="down"/></summary><div class="builder-settings-body">
      <Field label="Название шаблона" value={type.name} onChange={value => change('name', value)} required maxLength="80" placeholder="Например, Тренировка"/>
      <Select label="Шаблон связанной записи" value={type.recordKind} onChange={value => setType(previous=>({...previous,recordKind:value,fields:previous.fields.map(field=>({...field,source:null}))}))}><option value="">Без связи</option>{type.recordKind==='any' && <option value="any">Любая запись (старый шаблон)</option>}{recordKinds(data).map(kind => <option key={kind} value={kind}>{RECORD_KINDS[kind] || kind}</option>)}</Select>
      <p class="quiet-note">Общие поля настраиваются в разделе «Редактор шаблонов → Записи».</p>
      {type.recordKind && <Check checked={type.requireRecord} onChange={value => change('requireRecord', value)}>Связанная запись обязательна</Check>}
      <Check checked={type.enableLocation} onChange={value => change('enableLocation', value)}>Можно выбрать место на карте</Check>
      </div></details><div class="builder-heading"><h3>Дополнительные поля</h3><Button icon="plus" onClick={addField}>Добавить поле</Button></div>
      {type.fields.length === 0 && <p class="builder-empty">Название, дата и время уже есть. Добавь поля для своих событий.</p>}
      <div class="builder-fields">{type.fields.map((field, index) => {
        const hasValues = used(field);
        return <details key={field.id} class={`builder-field ${field.archived ? 'field-archived' : ''}`} open={activeField === field.id} onToggle={event => { if (event.currentTarget.open) setActiveField(field.id); else if (activeField === field.id) setActiveField(''); }}><summary class="builder-field-summary"><Icon name={field.type === 'url' ? 'external' : field.type === 'checkbox' ? 'check' : 'sliders'}/><strong>{field.label || 'Новое поле'}</strong><small>{field.archived ? 'Скрыто' : FIELD_TYPES[field.type]}</small><Icon name="down"/></summary><div class="builder-field-body">
        <div class="builder-field-header"><span>Настройки поля</span><div><button type="button" class="icon-button" aria-label={`Поднять поле ${index + 1}`} disabled={index === 0} onClick={() => reorder(field.id, -1)}>↑</button><button type="button" class="icon-button" aria-label={`Опустить поле ${index + 1}`} disabled={index === type.fields.length - 1} onClick={() => reorder(field.id, 1)}>↓</button><button type="button" class="text-button" onClick={() => updateField(field.id, { archived: !field.archived, required: false })}>{field.archived ? 'Вернуть' : 'Скрыть'}</button></div></div>
        <div class="form-row"><Field label="Название поля" value={field.label} onChange={value => updateField(field.id, { label: value })} required maxLength="100"/><Select label={field.source ? 'Формат из записи' : 'Формат'} value={field.type} onChange={value => updateField(field.id, { type: value, source:null, metric:false, ...(value === 'url' && field.showCompact == null ? { showCompact: true } : {}) })} disabled={Boolean(field.source) || hasValues}>{Object.entries(FIELD_TYPES).filter(([id])=>id!=='date' || field.type==='date').map(([id,label])=><option key={id} value={id}>{label}</option>)}</Select></div>
        {isChoiceField(field.type) && (field.source
          ? <p class="quiet-note">Варианты из шаблона записи · {field.options.join(', ')}</p>
          : <FieldOptionsEditor label={field.label} options={field.options} onChange={options=>updateField(field.id,{options})}/>)}
        {!field.archived && (sources.length > 0 || field.source) &&
          <Select label="Источник значения" value={field.source?.fieldId || ''} onChange={fieldId=>chooseSource(field,fieldId)}>
            <option value="">Заполнять в событии</option>
            {field.source && !sources.some(item=>item.id===field.source.fieldId) && <option value={field.source.fieldId}>Ранее настроенное поле</option>}
            {sources.map(item=><option key={item.id} value={item.id} disabled={hasValues && item.type!==field.type && field.source?.fieldId!==item.id}>{item.label} · {FIELD_TYPES[item.type]}</option>)}
          </Select>}
        {!field.archived && field.type==='number' && <><Check checked={field.metric ?? (type.id==='lesson' && field.id==='rate')} onChange={metric=>updateField(field.id,{metric})}>Суммировать в статистике</Check>
          {field.metric && <Field label="Единица измерения" value={field.metricUnit || ''} maxLength="24" placeholder="Например, км" onChange={metricUnit=>updateField(field.id,{metricUnit})}/>}</>}
        {!field.archived && <Check checked={field.required} onChange={value => updateField(field.id, { required: value })}>Обязательное</Check>}
        {hasValues && <small class="quiet-note">Формат поля зафиксирован: в событиях уже есть значения. Можно переименовать или скрыть поле — данные сохранятся.</small>}
      </div></details>; })}</div>
      </div>
      <ErrorMessage error={error}/><FormFooter onClose={onClose} label="Сохранить шаблон">{data.types.some(item => item.id === original?.id) && onDelete && <ActionMenu label="Ещё" items={[{id:'delete',icon:'trash',label:'Удалить шаблон',danger:true,onSelect:onDelete}]}/>}</FormFooter>
    </form>
  </Modal>;
}
