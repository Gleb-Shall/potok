import { useState } from 'preact/hooks';
import { Field, Select, Check, Button, Colors } from './UI.jsx';
import { Icon } from './Icon.jsx';
import { linkParts } from '../lib/links.js';

export function RecordFields({ value = [], onChange }) {
  const [active, setActive] = useState(() => value.find(item => !item.label)?.id || '');
  const update = (index, patch) => onChange(value.map((item, i) => i === index ? { ...item, ...patch } : item));
  const add = () => { const id = crypto.randomUUID(); onChange([...value, { id, label:'', type:'text', value:'', showOnCard:true }]); setActive(id); };
  return <section class="record-info-editor"><div class="builder-heading"><h3>Постоянные поля</h3><Button icon="plus" onClick={add}>Добавить поле</Button></div>
    {!value.length && <p class="builder-empty">Добавь преподавателя, адрес или общую ссылку для связанных событий.</p>}
    {value.map((item, index) => { const id = item.id || String(index); return <details class="record-detail-editor" key={id} open={active === id} onToggle={event => { if (event.currentTarget.open) setActive(id); else if (active === id) setActive(''); }}><summary><span><strong>{item.label || 'Новое поле'}</strong><small>{item.value || 'Не заполнено'}</small></span><Icon name="down"/></summary><div class="record-detail-editor-body"><div class="form-row"><Field label="Название поля" value={item.label} maxLength="100" onChange={label => update(index, { label })}/><Select label="Формат сведения" value={item.type || 'text'} onChange={type => update(index, { type })}><option value="text">Текст</option><option value="url">Ссылка</option></Select></div><Field label="Значение" value={item.value} type={item.type === 'url' ? 'url' : 'text'} maxLength="1000" placeholder={item.type === 'url' ? 'https://…' : undefined} onInvalid={event => { event.currentTarget.closest('details').open = true; setActive(id); }} onChange={text => update(index, { value:text })}/><div class="record-detail-actions">{(item.type === 'url' || linkParts(item.value).some(part => part.href)) && <Check checked={item.showOnCard !== false} onChange={showOnCard => update(index, { showOnCard })}>Показывать ссылку в событиях</Check>}<Button kind="text-button danger-text" icon="trash" onClick={() => onChange(value.filter((_, i) => i !== index))}>Удалить поле</Button></div></div></details>; })}
  </section>;
}
export function RecordExtras({ notes, color, onNotes, onColor }) {
  return <details class="record-extras"><summary>Заметки и оформление<Icon name="down"/></summary><div><Field label="Заметки" type="textarea" rows="3" value={notes} onChange={onNotes} maxLength="5000"/><Colors value={color} onChange={onColor}/></div></details>;
}
