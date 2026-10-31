import { initials } from './UI.jsx';
import { RECORD_KINDS } from '../lib/events.js';
export function RecordSummaryPreview({record,student=false}) {
  return <aside class="record-edit-preview"><h3>Твоя запись</h3><div class="record-preview-identity"><span class={`record-initials color-${record.color}`}>{initials(record.name||'Новая запись')}</span><div><strong>{record.name||'Имя или название'}</strong><span>{student?'Ученик':RECORD_KINDS[record.kind]||record.kind}</span></div></div><p>{record.subject||record.subtitle||'Короткое описание появится здесь.'}</p><dl>{record.contact&&<div><dt>Контакт</dt><dd>{record.contact}</dd></div>}{(record.details||[]).filter(field=>field.label).slice(0,3).map((field,index)=><div key={field.id||index}><dt>{field.label}</dt><dd>{field.value||'Не заполнено'}</dd></div>)}</dl><p class="record-preview-caption">Эти сведения будут доступны в связанных событиях. Время каждой встречи задаётся отдельно.</p></aside>;
}
