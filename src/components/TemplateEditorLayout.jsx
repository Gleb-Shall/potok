import { FIELD_TYPES } from '../lib/events.js';
import { useFieldReorder } from '../hooks/useFieldReorder.js';
import { Icon } from './Icon.jsx';
import { Button, ErrorMessage, Field, FormFooter, Modal, Select } from './UI.jsx';

export function TemplateEditorLayout({ title, error, onClose, onSubmit, actions, inline, busy, children }) {
  const form = <form class="type-builder-form" onSubmit={onSubmit} noValidate>
    <div class="builder-main">{children}</div>
    <ErrorMessage error={error}/>
    <FormFooter onClose={onClose} label="Сохранить шаблон" disabled={busy}>{actions}</FormFooter>
  </form>;
  if (inline) return <div class="product-dialog template-inline-editor">{form}</div>;
  return <Modal title={title} subtitle="Поля, форматы и правила заполнения" wide onClose={onClose} className="product-dialog template-editor-dialog" panel>
    {form}
  </Modal>;
}

export function TemplateEditorSettings({ description, open, onToggle, children }) {
  return <details class="builder-settings" open={open}>
    <summary onClick={event => { event.preventDefault(); onToggle(!open); }}>
      <span>Общие настройки</span>{description && <small>{description}</small>}<Icon name="down"/>
    </summary>
    <div class="builder-settings-body">{children}</div>
  </details>;
}

export function TemplateEditorFields({ fields, renderField, onMove, onRemove, emptyMessage, onAdd, children }) {
  const {list,gripProps} = useFieldReorder(fields.length, onMove);
  return <>
    <div class="builder-heading"><h3>Дополнительные поля</h3><Button icon="plus" onClick={onAdd}>Добавить поле</Button></div>
    {emptyMessage && <p class="builder-empty">{emptyMessage}</p>}
    <ul class="builder-fields" ref={list}>
      {fields.map((field,index) => <li class={`builder-field-row${onRemove ? ' has-field-remove' : ''}`} key={field.id}>
        <button type="button" class="card-style-grip builder-field-grip" {...gripProps(index,field.label || 'Новое поле')}>
          <span aria-hidden="true">⠿</span>
        </button>
        {renderField(field)}
        {onRemove && <Button kind="secondary builder-field-delete" icon="trash"
          title="Удалить поле" aria-label={`Удалить поле «${field.label || 'Новое поле'}»`} onClick={()=>onRemove(field)}/>}
      </li>)}
    </ul>
    {children}
  </>;
}

export function TemplateEditorField({ field, open, onToggle, formatLocked, showOptions, children }) {
  return <details class="builder-field" open={open}>
    <summary class="builder-field-summary" onClick={event => { event.preventDefault(); onToggle(open ? '' : field.id); }}>
      <strong>{field.label || 'Новое поле'}{showOptions && field.options?.some(option => option.trim()) && <small>{field.options.filter(option => option.trim()).join(' · ')}</small>}</strong>
      <small class="builder-format-tag">{formatLocked && <Icon name="lock"/>}{FIELD_TYPES[field.type]}</small><Icon name="down"/>
    </summary>
    <div class="builder-field-body">
      {children}
    </div>
  </details>;
}

export function TemplateFieldIdentity({ field, formats, formatLockReason, onLabelChange, onFormatChange }) {
  return <div class="form-row">
    <Field label="Название поля" value={field.label} onChange={onLabelChange} required maxLength="100"/>
    {formatLockReason ? <div class="field builder-format-fixed">
      <span>{field.source ? 'Формат из записи' : 'Формат'}</span>
      <div><Icon name="lock"/><strong>{FIELD_TYPES[field.type]}</strong></div>
      <small>{formatLockReason}</small>
    </div> : <Select label="Формат" value={field.type} onChange={onFormatChange}>
        {formats.map(id => <option key={id} value={id}>{FIELD_TYPES[id]}</option>)}
      </Select>}
  </div>;
}
