import { useState } from 'preact/hooks';
import { Icon } from './Icon.jsx';
import { initials } from './UI.jsx';
import { RECORD_KINDS } from '../lib/events.js';
export function RecordSummaryPreview({record,student=false}) {
  const [open, setOpen] = useState(() => window.innerWidth > 760);
  return <details class="record-edit-preview" open={open} onToggle={event => setOpen(event.currentTarget.open)}><summary>Предпросмотр<Icon name="down"/></summary><div class="record-preview-body"><div class="record-preview-identity"><span class={`record-initials color-${record.color}`}>{initials(record.name||'Новая запись')}</span><div><strong>{record.name||'Имя или название'}</strong><span>{student?'Ученик':RECORD_KINDS[record.kind]||record.kind}</span></div></div>{(record.subject||record.subtitle)&&<p>{record.subject||record.subtitle}</p>}<dl>{record.contact&&<div><dt>Контакт</dt><dd>{record.contact}</dd></div>}{(record.details||[]).filter(field=>field.label).slice(0,3).map((field,index)=><div key={field.id||index}><dt>{field.label}</dt><dd>{field.value||'Не заполнено'}</dd></div>)}</dl></div></details>;
}
