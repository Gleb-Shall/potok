import { Field, Select, Check, Button } from './UI.jsx';
import { linkParts } from '../lib/links.js';

export function RecordFields({ value = [], onChange }) {
  const update = (index, patch) => onChange(value.map((item, i) => i === index ? { ...item, ...patch } : item));
  return <section class="record-info-editor"><h3>Постоянные сведения</h3><p class="quiet-note">Например: преподаватель, адрес, ссылка на доску. Общие ссылки можно показывать прямо в событиях этой записи.</p>
    {value.map((item, index) => <div class="record-detail-editor" key={item.id || index}>
      <div class="form-row"><Field label="Поле" value={item.label} maxLength="100" onChange={label => update(index, { label })}/><Select label="Формат сведения" value={item.type || 'text'} onChange={type => update(index, { type })}><option value="text">Текст</option><option value="url">Ссылка</option></Select></div>
      <Field label="Значение" value={item.value} type={item.type === 'url' ? 'url' : 'text'} maxLength="1000" placeholder={item.type === 'url' ? 'https://…' : undefined} onChange={text => update(index, { value: text })}/>
      <div class="record-detail-actions">{(item.type === 'url' || linkParts(item.value).some(part => part.href)) && <Check checked={item.showOnCard !== false} onChange={showOnCard => update(index, { showOnCard })}>Ссылка в карточках событий</Check>}<Button kind="text-button danger-text" onClick={() => onChange(value.filter((_, i) => i !== index))}>Убрать сведение</Button></div>
    </div>)}<Button icon="plus" onClick={() => onChange([...value, { id: crypto.randomUUID(), label: '', type: 'text', value: '', showOnCard: true }])}>Добавить сведение</Button>
  </section>;
}
