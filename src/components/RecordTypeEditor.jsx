import { useState } from 'preact/hooks';
import { allRecords, FIELD_TYPES, RECORD_KINDS, recordKinds, saveRecordType } from '../lib/events.js';
import { builtinRecordFields, declaredRecordFields, isChoiceField, RECORD_FIELD_FORMATS, recordFieldCatalog } from '../lib/record-field-links.js';
import { FieldOptionsEditor } from './FieldOptionsEditor.jsx';
import { Button, ErrorMessage, Field, FormFooter, Modal, Select } from './UI.jsx';

export function RecordTypeEditor({data,kind = '',onSave,onClose}) {
  const [name,setName] = useState('');
  const [fields,setFields] = useState(()=>declaredRecordFields(data,kind));
  const [error,setError] = useState('');
  const kinds = recordKinds(data);
  const reusable = recordFieldCatalog(allRecords(data),kind)
    .filter(field=>field.id.startsWith('detail:') && !fields.some(item=>item.id===field.id.slice(7)));
  const add = field => setFields([...fields,field ? {...field,id:field.id.slice(7)} : {id:crypto.randomUUID(),label:'',type:'text'}]);
  const update = (id,patch) => setFields(fields.map(field=>field.id===id ? {...field,...patch} : field));
  const submit = event => {
    event.preventDefault();
    setError('');
    try {
      if (!kind && kinds.some(id=>[id,RECORD_KINDS[id]].some(label=>label?.toLocaleLowerCase('ru')===name.trim().toLocaleLowerCase('ru'))))
        throw new Error('Этот шаблон уже есть. Выбери его в списке.');
      const builtin = Object.keys(RECORD_KINDS).find(id=>RECORD_KINDS[id].toLocaleLowerCase('ru')===name.trim().toLocaleLowerCase('ru'));
      const savedKind = kind || builtin || name.trim();
      onSave(saveRecordType(data,savedKind,fields),'Шаблон записи сохранён',savedKind);
    } catch (error) {setError(error.message);}
  };
  return <Modal title={kind ? RECORD_KINDS[kind] || kind : 'Новый шаблон записи'} subtitle="Общие поля для записей по одному шаблону" onClose={onClose} className="product-dialog compact-dialog">
    <form class="record-edit-form" onSubmit={submit}>
      {!kind && <Field label="Название шаблона" value={name} onChange={setName} required maxLength="80"/>}
      <p class="quiet-note">Встроенные поля · {builtinRecordFields(kind || name || 'new').map(field=>field.label).join(', ')}</p>
      <section class="record-info-editor">
        <div class="builder-heading"><h3>Поля шаблона</h3><Button icon="plus" onClick={()=>add()}>Добавить поле</Button></div>
        {fields.map(field=><section class="record-schema-field" key={field.id}><div class="form-row record-type-field">
          <Field label="Название поля" value={field.label} onChange={label=>update(field.id,{label})} required maxLength="100"/>
          <Select label="Формат" value={field.type} onChange={type=>update(field.id,{type})}>
            {RECORD_FIELD_FORMATS.map(id=><option key={id} value={id}>{FIELD_TYPES[id]}</option>)}
          </Select>
          <Button icon="trash" aria-label={`Убрать поле ${field.label}`} onClick={()=>setFields(fields.filter(item=>item.id!==field.id))}/>
        </div>
          {isChoiceField(field.type) && <FieldOptionsEditor label={field.label} options={field.options} onChange={options=>update(field.id,{options})}/>}
        </section>)}
        {reusable.length>0 && <Select label="Добавить из существующих записей" value="" onChange={id=>{const field=reusable.find(item=>item.id===id);if(field) add(field);}}>
          <option value="">Выбери поле</option>{reusable.map(field=><option key={field.id} value={field.id}>{field.label} · {FIELD_TYPES[field.type]}</option>)}
        </Select>}
      </section>
      <ErrorMessage error={error}/><FormFooter onClose={onClose} label="Сохранить шаблон"/>
    </form>
  </Modal>;
}
