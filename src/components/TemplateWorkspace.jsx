import { useEffect, useRef, useState } from 'preact/hooks';
import { RECORD_KINDS, recordKinds } from '../lib/events.js';
import { Icon } from './Icon.jsx';
import { RecordTypeEditor } from './RecordTypeEditor.jsx';
import { TypeEditor } from './TypeEditor.jsx';
import { Button } from './UI.jsx';

const confirmDiscard = () => window.confirm('Отменить несохранённые изменения в шаблоне?');

export function TemplateWorkspace({ data, onSave, onDelete, onArchive, initialDraft, leaveGuard, onEditingChange }) {
  const [family, setFamily] = useState(initialDraft || 'events');
  const [selection, setSelection] = useState({events:'',records:''});
  const [draft, setDraft] = useState(() => initialDraft ? {name:''} : null);
  const [editorKey, setEditorKey] = useState(0);
  const [dirty, setDirty] = useState(false);
  const draftInput = useRef(null);
  const revision = useRef(data.revision);
  const records = family === 'records';
  const templates = records
    ? recordKinds(data,{includeArchived:true}).map(id => ({id,name:RECORD_KINDS[id] || id,archived:data.archivedRecordKinds?.includes(id)}))
    : data.types;
  const entries = templates.filter(entry=>!entry.archived);
  const archived = templates.filter(entry=>entry.archived);
  const active = entries.find(entry => entry.id === selection[family]) || entries[0];
  const changed = dirty || Boolean(draft?.name);

  useEffect(() => {
    if (!leaveGuard) return;
    leaveGuard.current = changed ? confirmDiscard : null;
    return () => { leaveGuard.current = null; };
  }, [leaveGuard, changed]);
  useEffect(() => { onEditingChange?.(changed); }, [onEditingChange, changed]);
  useEffect(() => () => { onEditingChange?.(false); }, [onEditingChange]);
  useEffect(() => { draftInput.current?.focus(); }, [editorKey]);
  useEffect(() => {
    if (revision.current === data.revision) return;
    revision.current = data.revision;
    if (!changed && !draft) setEditorKey(value => value + 1);
  }, [data.revision, changed, draft]);

  const reset = () => {
    setDraft(null);
    setDirty(false);
    setEditorKey(value => value + 1);
  };
  const select = id => setSelection(previous => ({...previous,[family]:id}));
  const changeEditor = next => {
    if (changed && !confirmDiscard()) return;
    reset();
    next?.();
  };
  const copy = entry => changeEditor(() => setDraft({
    name:`${entry.name.slice(0, 72)} (копия)`,
    original:{...entry,id:crypto.randomUUID(),archived:false,version:0},
  }));
  const save = (next, message, id) => {
    const finish = saved => {
      if (saved === false) return;
      select(id);
      reset();
    };
    const result = onSave(next, message);
    return result?.then ? result.then(finish) : finish(result);
  };
  const editorProps = {
    data, inline:true, draftName:draft?.name, onDirty:setDirty,
    onSave:save, onClose:() => { if (draft || dirty) reset(); },
  };
  const deleteEntry = entry => onDelete(records ? {kind:'record-template',value:entry.id} : {kind:'type',value:entry});
  const archiveEntry = (entry, value) => changeEditor(() => onArchive(family,entry.id,value));

  return <section class="template-browser template-workspace" aria-label="Редактор шаблонов">
    <div class="template-browser-layout">
      <aside class="template-browser-list" aria-label="Список шаблонов">
        <div class="week-layout-switch template-family-switch" role="group" aria-label="Шаблоны">
          <button type="button" aria-pressed={!records} onClick={() => { if (records) changeEditor(() => setFamily('events')); }}>События</button>
          <button type="button" aria-pressed={records} onClick={() => { if (!records) changeEditor(() => setFamily('records')); }}>Записи</button>
        </div>
        <Button class="button template-create" icon="plus" onClick={() => changeEditor(() => setDraft({name:''}))}>
          {records ? 'Создать шаблон записи' : 'Создать шаблон события'}
        </Button>
        {draft && <div class="template-draft-row">
          <label><span>Черновик</span><input ref={draftInput} aria-label="Название шаблона" placeholder="Название шаблона" maxLength={80} value={draft.name}
            onInput={event => { const name = event.currentTarget.value; setDraft(previous => ({...previous,name})); }}/></label>
        </div>}
        {entries.map(entry => {
          const selected = !draft && active?.id === entry.id;
          return <div class={`template-list-item${selected ? ' selected' : ''}`} key={entry.id}>
            <button type="button" class="template-list-select" aria-pressed={selected} onClick={() => { if (!selected) changeEditor(() => select(entry.id)); }}>{entry.name}</button>
            <details class="tile-actions-menu">
              <summary aria-label={`Другие действия с шаблоном «${entry.name}»`}><Icon name="more"/></summary>
              <div>
                {!records && <button type="button" onClick={event => { event.currentTarget.closest('details').open = false; copy(entry); }}>Создать копию</button>}
                {onArchive && <button type="button" onClick={event => { event.currentTarget.closest('details').open = false; archiveEntry(entry,true); }}>В архив</button>}
                <button type="button" class="danger-text" onClick={event => { event.currentTarget.closest('details').open = false; deleteEntry(entry); }}>Удалить шаблон</button>
              </div>
            </details>
          </div>;
        })}
        {archived.length>0 && <details class="template-archive-list">
          <summary>Архив шаблонов <span class="section-count">{archived.length}</span></summary>
          {archived.map(entry=><div class="template-archived-row" key={entry.id}>
            <span>{entry.name}</span><details class="tile-actions-menu">
              <summary aria-label={`Действия с архивным шаблоном «${entry.name}»`}><Icon name="more"/></summary>
              <div>{onArchive && <button type="button" onClick={event=>{event.currentTarget.closest('details').open=false;archiveEntry(entry,false);}}>Вернуть из архива</button>}
                <button type="button" class="danger-text" onClick={event=>{event.currentTarget.closest('details').open=false;deleteEntry(entry);}}>Удалить шаблон</button>
              </div>
            </details>
          </div>)}
        </details>}
      </aside>
      <div class="template-workspace-editor">
        {draft || active ? <>
          <h2>{draft ? (records ? 'Новый шаблон записи' : 'Новый шаблон события') : active.name}</h2>
          {records ? <RecordTypeEditor key={`record:${editorKey}:${active?.id}`} {...editorProps} kind={draft ? '' : active.id}/>
            : <TypeEditor key={`event:${editorKey}:${active?.id}`} {...editorProps} original={draft ? draft.original : active}/>}
        </> : <p class="builder-empty">Создай шаблон, чтобы настроить его поля.</p>}
      </div>
    </div>
  </section>;
}
