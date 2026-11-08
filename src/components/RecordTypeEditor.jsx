import { useEffect, useRef, useState } from 'preact/hooks';
import { allRecords, FIELD_TYPES, RECORD_KINDS, recordKinds, saveRecordType } from '../lib/events.js';
import { builtinRecordFields, declaredRecordFields, isChoiceField, RECORD_FIELD_FORMATS, recordFieldCatalog } from '../lib/record-field-links.js';
import { moveField } from '../hooks/useFieldReorder.js';
import { FieldOptionsEditor } from './FieldOptionsEditor.jsx';
import { TemplateEditorLayout, TemplateEditorSettings, TemplateEditorFields, TemplateEditorField, TemplateFieldIdentity } from './TemplateEditorLayout.jsx';
import { Field, Select } from './UI.jsx';

export function RecordTypeEditor({data,kind = '',onSave,onClose,inline,draftName,onDirty}) {
  const [localName,setName] = useState(RECORD_KINDS[kind] || kind);
  const name = draftName ?? localName;
  const [fields,setFields] = useState(()=>declaredRecordFields(data,kind));
  const initial = useRef(fields);
  const [activeField,setActiveField] = useState(inline ? '' : fields[0]?.id || '');
  const [basicsOpen,setBasicsOpen] = useState(!kind);
  const [error,setError] = useState('');
  const dirty = initial.current !== fields;
  useEffect(() => { onDirty?.(dirty); }, [dirty, onDirty]);
  const kinds = recordKinds(data);
  const reusable = recordFieldCatalog(allRecords(data),kind)
    .filter(field=>field.id.startsWith('detail:') && !fields.some(item=>item.id===field.id.slice(7)));
  const add = source => {
    const field = source ? {...source,id:source.id.slice(7)} : {id:crypto.randomUUID(),label:'',type:'text'};
    setFields(previous => [...previous,field]);
    setActiveField(field.id);
  };
  const update = (id,patch) => setFields(previous => previous.map(field=>field.id===id ? {...field,...patch} : field));
  const submit = event => {
    event.preventDefault();
    setError('');
    try {
      if (!kind && kinds.some(id=>[id,RECORD_KINDS[id]].some(label=>label?.toLocaleLowerCase('ru')===name.trim().toLocaleLowerCase('ru'))))
        throw new Error('Этот шаблон уже есть. Выбери его в списке.');
      const builtin = Object.keys(RECORD_KINDS).find(id=>RECORD_KINDS[id].toLocaleLowerCase('ru')===name.trim().toLocaleLowerCase('ru'));
      const savedKind = kind || builtin || name.trim();
      onSave(saveRecordType(data,savedKind,fields),'Шаблон записи сохранён',savedKind);
    } catch (error) {
      setError(error.message);
      if (!kind && (!name.trim() || name.trim().length > 80)) setBasicsOpen(true);
      else {
        const field = fields.find(item => !item.label.trim() || isChoiceField(item.type) && !item.options?.some(value => value.trim()));
        if (field) setActiveField(field.id);
      }
    }
  };
  const builtinFields = builtinRecordFields(kind || 'new');
  return <TemplateEditorLayout title={kind ? 'Шаблон записи' : 'Новый шаблон записи'} error={error} onClose={onClose} onSubmit={submit} inline={inline}>
    {inline ? <section class="template-builtin-fields" aria-label="Встроенные поля">
      <h3>Встроенные поля</h3>
      <dl class="record-template-fields">{builtinFields.map(field => <div key={field.id}><dt>{field.label}</dt><dd>{FIELD_TYPES[field.type]}</dd></div>)}</dl>
    </section> : <TemplateEditorSettings description={name || 'Название и встроенные поля'} open={basicsOpen} onToggle={setBasicsOpen}>
      <Field label="Название шаблона" value={name} onChange={setName} readOnly={Boolean(kind)} required maxLength="80" placeholder="Например, Проект"/>
      <p class="quiet-note">Встроенные поля · {builtinFields.map(field=>field.label).join(', ')}</p>
    </TemplateEditorSettings>}
    <TemplateEditorFields fields={fields} onMove={(from,to) => setFields(previous => moveField(previous,from,to))}
      onAdd={()=>add()} emptyMessage={!fields.length && 'Добавь поля, которые будут общими для записей по этому шаблону.'} renderField={field => {
        const remove = <button type="button" class="text-button" onClick={()=>{
          setFields(previous => previous.filter(item=>item.id!==field.id));
          setActiveField('');
        }}>Убрать поле</button>;
        return <TemplateEditorField field={field} open={activeField===field.id} onToggle={setActiveField} action={remove} showOptions={inline}>
          <TemplateFieldIdentity field={field} formats={RECORD_FIELD_FORMATS} onLabelChange={label=>update(field.id,{label})} onFormatChange={type=>update(field.id,{type})}/>
          {isChoiceField(field.type) && <FieldOptionsEditor label={field.label} options={field.options} onChange={options=>update(field.id,{options})}/>}
        </TemplateEditorField>;
      }}>
      {reusable.length>0 && <Select label="Добавить из существующих записей" value="" onChange={id=>{const field=reusable.find(item=>item.id===id);if(field) add(field);}}>
        <option value="">Выбери поле</option>{reusable.map(field=><option key={field.id} value={field.id}>{field.label} · {FIELD_TYPES[field.type]}</option>)}
      </Select>}
    </TemplateEditorFields>
  </TemplateEditorLayout>;
}
