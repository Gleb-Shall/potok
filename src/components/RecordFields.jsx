import { useState } from 'preact/hooks';
import { Field, Select, Check, Button, Colors } from './UI.jsx';
import { Icon } from './Icon.jsx';
import { linkParts } from '../lib/links.js';
import { isChoiceField, RECORD_FIELD_FORMATS, recordFieldCatalog } from '../lib/record-field-links.js';

import { FIELD_TYPES, fieldDisplay } from '../lib/events.js';
import { FieldOptionsEditor } from './FieldOptionsEditor.jsx';

function RecordValueField({field,value,onChange,onInvalid,label=field.label}) {
  if (isChoiceField(field.type)) {
    const selected = field.type==='multiselect' ? Array.isArray(value) ? value : [] : value ? [value] : [];
    const options = [...new Set([...(field.options || []).filter(Boolean),...selected])];
    if (field.type==='multiselect') return <fieldset class="multi-choice"><legend>{label}</legend><div>
      {options.map(option=><Check key={option} checked={selected.includes(option)} onChange={checked=>onChange(checked ? [...selected,option] : selected.filter(item=>item!==option))}>{option}</Check>)}
    </div></fieldset>;
    return <Select label={label} value={value ?? ''} onChange={onChange}>
      <option value="">Выбери вариант</option>{options.map(option=><option key={option} value={option}>{option}</option>)}
    </Select>;
  }
  return <Field label={label} value={value} type={field.type==='number' ? 'number' : 'text'} step={field.type==='number' ? 'any' : undefined}
    inputMode={field.type==='url' ? 'url' : undefined} placeholder={field.type==='url' ? 'https://…' : undefined}
    maxLength="1000" onInvalid={onInvalid} onChange={onChange}/>;
}

export function RecordFields({ value = [], onChange, records = [], kind, defined = [] }) {
  const declaredIds = new Set(defined.map(field=>field.id));
  const [active, setActive] = useState(() => value.find(item => !item.label)?.id || '');
  const update = (index, patch) => onChange(value.map((item, i) => i === index ? { ...item, ...patch } : item));
  const reusable = recordFieldCatalog(records,kind).filter(field=>field.id.startsWith('detail:') && !declaredIds.has(field.id.slice(7)) && !value.some(item=>item.id===field.id.slice(7)));
  const add = (field) => {
    const id = field ? field.id.slice(7) : crypto.randomUUID();
    onChange([...value,{id,label:field?.label || '',type:field?.type || 'text',options:field?.options,value:'',showOnCard:true}]);
    setActive(id);
  };
  const local = value.filter(field=>!declaredIds.has(field.id));
  return <section class="record-info-editor">{defined.length>0 && <section class="record-defined-fields">
    <h3>Поля шаблона записи</h3>
    {defined.map(field=>{
      const saved = value.find(item=>item.id===field.id);
      const change = patch => {
        const next = {...saved,...field,...patch};
        onChange(saved ? value.map(item=>item.id===field.id ? next : item) : [...value,next]);
      };
      return <div key={field.id}>
        <RecordValueField field={field} value={saved?.value} onChange={value=>change({value})}/>
        {field.type==='url' && saved?.value && <Check checked={saved.showOnCard!==false} onChange={showOnCard=>change({showOnCard})}>Показывать ссылку в событиях</Check>}
      </div>;
    })}
  </section>}<div class="builder-heading"><h3>Дополнительные поля записи</h3><Button icon="plus" onClick={()=>add()}>Добавить поле</Button></div>
    {reusable.length > 0 && <Select label="Добавить поле из записей по шаблону" value="" onChange={id=>{const field=reusable.find(item=>item.id===id);if(field) add(field);}}><option value="">Выбери общее поле</option>{reusable.map(field=><option key={field.id} value={field.id}>{field.label}</option>)}</Select>}
    {!local.length && <p class="builder-empty">Добавь преподавателя, адрес или общую ссылку для связанных событий.</p>}
    {value.map((item, index) => { if (declaredIds.has(item.id)) return null; const id = item.id || String(index); return <details class="record-detail-editor" key={id} open={active === id} onToggle={event => { if (event.currentTarget.open) setActive(id); else if (active === id) setActive(''); }}><summary><span><strong>{item.label || 'Новое поле'}</strong><small>{fieldDisplay(item,item.value) || 'Не заполнено'}</small></span><Icon name="down"/></summary><div class="record-detail-editor-body"><div class="form-row"><Field label="Название поля" value={item.label} maxLength="100" onChange={label => update(index, { label })}/><Select label="Формат сведения" value={item.type || 'text'} onChange={type => update(index, { type,...(isChoiceField(type) || isChoiceField(item.type) ? {value:''} : {}) })}>{RECORD_FIELD_FORMATS.map(format=><option key={format} value={format}>{FIELD_TYPES[format]}</option>)}</Select></div>{isChoiceField(item.type) && <FieldOptionsEditor label={item.label} options={item.options} onChange={options=>update(index,{options})}/>}<RecordValueField label="Значение" field={item} value={item.value} onInvalid={event => { event.currentTarget.closest('details').open = true; setActive(id); }} onChange={value => update(index, {value})}/><div class="record-detail-actions">{(item.type === 'url' || linkParts(item.value).some(part => part.href)) && <Check checked={item.showOnCard !== false} onChange={showOnCard => update(index, { showOnCard })}>Показывать ссылку в событиях</Check>}<Button kind="text-button danger-text" icon="trash" onClick={() => onChange(value.filter((_, i) => i !== index))}>Удалить поле</Button></div></div></details>; })}
  </section>;
}
export function RecordExtras({ notes, color, onNotes, onColor }) {
  return <details class="record-extras"><summary>Заметки и оформление<Icon name="down"/></summary><div><Field label="Заметки" type="textarea" rows="3" value={notes} onChange={onNotes} maxLength="5000"/><Colors value={color} onChange={onColor}/></div></details>;
}
