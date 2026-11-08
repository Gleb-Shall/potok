import { useState } from 'preact/hooks';
import { TemplateTile } from './TemplateTile.jsx';
import { Icon } from './Icon.jsx';

const fieldCount = count => `${count} ${{one:'поле',few:'поля',many:'полей',other:'полей'}[new Intl.PluralRules('ru').select(count)]}`;

export function TemplateBrowser({data,onEdit,onAppearance,onCopy,onDelete,onAdd}) {
  const [selected,setSelected] = useState('');
  const types = data.types;
  const active = types.find(type=>type.id===selected) || types[0];
  return <section class="template-browser" aria-label="Шаблоны событий">
    <div class="template-browser-layout">
      <div class="template-browser-list">
        {types.map(type=><article class={`template-gallery-card template-list-item ${active?.id===type.id?'selected':''}`} key={type.id}>
          <button class="template-list-select" onClick={()=>setSelected(type.id)} aria-pressed={active?.id===type.id}>
            <div><h3>{type.name}</h3><small>{fieldCount(type.fields.filter(field=>!field.archived).length)}{type.archived ? ' · Ранее архивирован' : ''}</small></div>
          </button>
          <details class="tile-actions-menu">
            <summary aria-label={`Другие действия с шаблоном «${type.name}»`}><Icon name="more"/></summary>
            <div>
              <button onClick={()=>onCopy(type)}>Создать копию</button>
              <button class="danger-text" onClick={()=>onDelete(type)}>Удалить шаблон</button>
            </div>
          </details>
        </article>)}
        <button class="template-new-row" onClick={onAdd}><Icon name="plus"/>Создать шаблон события</button>
      </div>
      <div class="template-preview-panel">
        {active ? <>
          <div class="template-preview-heading"><h3>Предпросмотр</h3></div>
          <TemplateTile key={active.id} type={active} data={data} onEdit={()=>onEdit(active)} onAppearance={onAppearance && (()=>onAppearance(active))}
            onCopy={()=>onCopy(active)} onDelete={()=>onDelete(active)}/>
        </> : <p>Создай шаблон, чтобы настроить свою карточку.</p>}
      </div>
    </div>
  </section>;
}
