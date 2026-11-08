import { FIELD_TYPES, RECORD_KINDS, recordKinds } from '../lib/events.js';
import { recordTypeFields } from '../lib/record-field-links.js';
import { Icon } from './Icon.jsx';
import { Button } from './UI.jsx';

export function RecordTemplateBrowser({data,selected,onSelect,onEdit,onDelete,onAdd}) {
  const kinds = recordKinds(data);
  const active = kinds.includes(selected) ? selected : kinds[0];
  const fields = recordTypeFields(data,active);
  return <section class="template-browser" aria-label="Шаблоны записей">
    <div class="template-browser-layout">
      <div class="template-browser-list">
        {kinds.map(kind=><article class={`template-gallery-card template-list-item ${active===kind ? 'selected' : ''}`} key={kind}>
          <button class="template-list-select" onClick={()=>onSelect(kind)} aria-pressed={active===kind}>
            <h3>{RECORD_KINDS[kind] || kind}</h3>
          </button>
          <details class="tile-actions-menu"><summary aria-label={`Другие действия с шаблоном «${RECORD_KINDS[kind] || kind}»`}><Icon name="more"/></summary>
            <div><button type="button" class="danger-text" onClick={()=>onDelete(kind)}>Удалить шаблон</button></div>
          </details>
        </article>)}
        <button class="template-new-row" onClick={onAdd}><Icon name="plus"/>Создать шаблон записи</button>
      </div>
      {active && <div class="template-preview-panel">
        <div class="template-preview-heading"><h3>{RECORD_KINDS[active] || active}</h3><Button icon="sliders" onClick={()=>onEdit(active)}>Поля шаблона</Button></div>
        <dl class="record-template-fields">{fields.map(field=><div key={field.id}>
          <dt>{field.label}</dt><dd>{FIELD_TYPES[field.type]}{field.options?.length>0 && <small>{field.options.join(' · ')}</small>}</dd>
        </div>)}</dl>
      </div>}
    </div>
  </section>;
}
