import { linkHref } from './links.js';

const common = [
  {id:'name',label:'Имя или название',type:'text'},
  {id:'contact',label:'Контакт',type:'text'},
  {id:'subject',label:'Направление',type:'text',kind:'student'},
  {id:'subtitle',label:'Короткое описание',type:'text',nonStudent:true},
];

export function recordFieldCatalog(records, kind) {
  if (!kind) return [];
  const fields = new Map();
  for (const field of common) {
    if (kind === 'any' || (!field.kind || field.kind === kind) && (!field.nonStudent || kind !== 'student')) {
      fields.set(`record:${field.id}`, {...field,id:`record:${field.id}`});
    }
  }
  for (const record of records) {
    if (kind !== 'any' && record.kind !== kind) continue;
    for (const field of record.details || []) {
      const id = `detail:${field.id}`;
      if (field.id && field.label && !fields.has(id)) fields.set(id,{id,label:field.label,type:field.type || 'text'});
    }
  }
  return [...fields.values()];
}

export function compatibleRecordField(source, targetType) {
  return source.type === targetType || targetType === 'textarea' && source.type === 'text' ||
    targetType === 'url' && source.id === 'record:contact';
}

export function readRecordField(record, field) {
  if (!record || !field.source) return undefined;
  const {fieldId} = field.source;
  if (typeof fieldId !== 'string') return undefined;
  const builtin = common.find(item => `record:${item.id}` === fieldId);
  const detail = fieldId?.startsWith('detail:') && record.details?.find(item => item.id === fieldId.slice(7));
  const source = builtin || detail;
  if (!source || !compatibleRecordField({...source,type:source.type || 'text',id:fieldId},field.type)) return undefined;
  const value = builtin ? record[builtin.id] : detail.value;
  if (value == null || value === '' || typeof value === 'string' && !value.trim()) return undefined;
  if (field.type === 'number') return Number.isFinite(Number(value)) ? Number(value) : undefined;
  if (field.type === 'url') return linkHref(value) || undefined;
  return value;
}

export function resolveRecordFields(fields, values = {}, record, mode = 'live') {
  let resolved = values;
  for (const field of fields) {
    if (field.source?.mode !== mode || Object.hasOwn(values,field.id)) continue;
    const value = readRecordField(record,field);
    if (value !== undefined) {
      if (resolved === values) resolved = {...values};
      resolved[field.id] = value;
    }
  }
  return resolved;
}
