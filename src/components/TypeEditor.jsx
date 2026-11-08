import { ActionMenu } from './ActionMenu.jsx';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { moveField } from '../hooks/useFieldReorder.js';
import { Field, Select, Check } from './UI.jsx';
import { FieldOptionsEditor } from './FieldOptionsEditor.jsx';
import { CardStyleSettings } from './CardStyleEditor.jsx';
import { TemplateEditorLayout, TemplateEditorSettings, TemplateEditorFields, TemplateEditorField, TemplateFieldIdentity } from './TemplateEditorLayout.jsx';
import { isChoiceField, recordTypeFields } from '../lib/record-field-links.js';
import { FIELD_TYPES, populatedEventFields, saveType, RECORD_KINDS, recordKind, recordKinds } from '../lib/events.js';

export function TypeEditor({ data, original, onSave, onClose, onDelete, inline, draftName, onDirty }) {
  const [type, setType] = useState(() => structuredClone(original ? { ...original, recordKind: recordKind(original), requireRecord: original.requireRecord ?? original.requireStudent, enableLocation: original.enableLocation !== false } : { id: crypto.randomUUID(), name: '', icon: '◇', color: 'peach', recordKind: inline ? null : '', requireRecord: false, enableLocation: true, fields: [], archived: false }));
  const initial = useRef(type);
  const [activeField, setActiveField] = useState(inline ? '' : original?.fields?.[0]?.id || '');
  const [basicsOpen, setBasicsOpen] = useState(!original);
  const [appearance, setAppearance] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const name = draftName ?? type.name;
  const needsRecordChoice = type.recordKind === null;
  const dirty = initial.current !== type;
  useEffect(() => { onDirty?.(dirty); }, [dirty, onDirty]);
  const change = (key, value) => setType(previous => ({ ...previous, [key]: value }));
  const updateField = (id, change) => setType(previous => ({ ...previous, fields: previous.fields.map(field => field.id === id ? { ...field, ...change } : field) }));
  const addField = () => {
    const id = crypto.randomUUID();
    setType(previous => ({ ...previous, fields: [...previous.fields, { id, label: '', type: 'text', required: false, showOnCard: true, archived: false, options: [] }] }));
    setActiveField(id);
  };
  const reorder = (from, to) => setType(previous => ({...previous, fields:moveField(previous.fields,from,to)}));
  const sources = recordTypeFields(data,type.recordKind);
  const linkedKinds = recordKinds(data);
  if (type.recordKind && type.recordKind!=='any' && !linkedKinds.includes(type.recordKind)) linkedKinds.push(type.recordKind);
  const populated = useMemo(() => populatedEventFields(data,type.id), [data,type.id]);
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
    if (busy) return;
    try {
      if (needsRecordChoice) throw new Error('Выбери шаблон записи или вариант «Без связи».');
      const input = { ...type, name, linkStudent: type.recordKind === 'student', requireStudent: type.recordKind === 'student' && type.requireRecord, requireRecord: Boolean(type.recordKind && type.requireRecord), fields: type.fields.map(field => ({ ...field, label: field.label.trim(), options: [...new Set(field.options.map(value => value.trim()).filter(Boolean))] })) };
      onSave(saveType(data, input), 'Шаблон события сохранён', type.id);
    } catch (error) {
      setError(error.message);
      setAppearance(false);
      if (!name.trim()) setBasicsOpen(true);
      else { const field = type.fields.find(field => !field.label.trim() || !field.archived && ['select','multiselect'].includes(field.type) && !field.options.some(value => value.trim())); if (field) setActiveField(field.id); }
    }
  };
  const actions = data.types.some(item => item.id === original?.id) && onDelete &&
    <ActionMenu label="Ещё" items={[{id:'delete',icon:'trash',label:'Удалить шаблон',danger:true,onSelect:onDelete}]}/>;
  return <TemplateEditorLayout title={original ? 'Шаблон события' : 'Новый шаблон события'} error={error} onClose={onClose} onSubmit={submit} actions={actions} inline={inline} busy={busy}>
    {inline && <div class="week-layout-switch template-editor-tabs" role="group" aria-label="Настройки шаблона события">
      <button type="button" aria-pressed={!appearance} disabled={busy} onClick={() => setAppearance(false)}>Поля</button>
      <button type="button" aria-pressed={appearance} disabled={needsRecordChoice} onClick={() => setAppearance(true)}>Вид карточки</button>
    </div>}
    {appearance ? <CardStyleSettings data={data} type={type} setType={setType} busy={busy} setBusy={setBusy}/> : <>
    <TemplateEditorSettings description={inline ? RECORD_KINDS[type.recordKind] || type.recordKind : name || 'Название, связи и место'} open={basicsOpen} onToggle={setBasicsOpen}>
      {draftName === undefined && <Field label="Название шаблона" value={name} onChange={value => change('name', value)} required maxLength="80" placeholder="Например, Тренировка"/>}
      <Select label="Шаблон связанной записи" value={type.recordKind ?? '__choose__'} onChange={value => setType(previous=>({...previous,recordKind:value,fields:previous.fields.map(field=>({...field,source:null}))}))}>{needsRecordChoice && <option value="__choose__" disabled>Выбери шаблон записи</option>}<option value="">Без связи</option>{type.recordKind==='any' && <option value="any">Любая запись (старый шаблон)</option>}{linkedKinds.map(kind => <option key={kind} value={kind}>{RECORD_KINDS[kind] || kind}{data.archivedRecordKinds?.includes(kind) ? ' · архив' : ''}</option>)}</Select>
      <p class="quiet-note">Общие поля настраиваются в разделе «Редактор шаблонов → Записи».</p>
      {type.recordKind && <Check checked={type.requireRecord} onChange={value => change('requireRecord', value)}>Связанная запись обязательна</Check>}
      <Check checked={type.enableLocation} onChange={value => change('enableLocation', value)}>Можно выбрать место на карте</Check>
    </TemplateEditorSettings>
    {needsRecordChoice ? <p class="builder-empty">Выбери шаблон записи или «Без связи», чтобы настроить поля события.</p> : <TemplateEditorFields fields={type.fields} onMove={reorder} onAdd={addField} emptyMessage={type.fields.length === 0 && 'Название, дата и время уже есть. Добавь поля для своих событий.'} renderField={field => {
        const hasValues = populated.has(field.id);
        const formatLockReason = field.source ? 'Формат наследуется из поля связанной записи.'
          : hasValues ? 'В сохранённых событиях уже есть значения этого поля.' : '';
        const action = <button type="button" class="text-button" onClick={() => updateField(field.id, { archived: !field.archived, required: false })}>{field.archived ? 'Вернуть поле' : 'Скрыть поле'}</button>;
        return <TemplateEditorField field={field} open={activeField === field.id} onToggle={setActiveField} action={action} formatLocked={Boolean(formatLockReason)}>
          <TemplateFieldIdentity field={field} formats={Object.keys(FIELD_TYPES).filter(id => id !== 'date' || field.type === 'date')}
            formatLockReason={formatLockReason} onLabelChange={label => updateField(field.id, { label })}
            onFormatChange={value => updateField(field.id, { type: value, source:null, metric:false, ...(value === 'url' && field.showCompact == null ? { showCompact: true } : {}) })}/>
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
        </TemplateEditorField>;
      }}/>}
    </>}
  </TemplateEditorLayout>;
}
