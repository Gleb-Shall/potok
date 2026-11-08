import { allRecords, eventFields, eventType } from './events.js';

const reportableEvents = data => [...data.events, ...(data.eventArchive || []).filter(item=>item.archiveKind==='event' && item.status==='done')];

export function recordStatisticsOptions(data) {
  const records = new Map(allRecords(data).map(record=>[record.id,record]));
  for (const event of reportableEvents(data)) {
    const record = event.snapshot?.record;
    if (record?.id && !records.has(record.id)) records.set(record.id,record);
  }
  return [...records.values()].sort((a,b)=>a.name.localeCompare(b.name,'ru'));
}

export function eventStatistics(data, month, recordId = '') {
  const entries = reportableEvents(data).filter(event => event.status === 'done' && event.date?.slice(0,7) === month &&
    (!recordId || eventRecordId(event) === recordId))
    .sort((a,b)=>b.date.localeCompare(a.date) || b.start-a.start);
  return summarizeEvents(data,entries);
}

export function summarizeEvents(data, entries) {
  const metrics = new Map();
  const contributions = new Map();
  let minutes = 0;
  for (const event of entries) {
    minutes += event.duration;
    const type = eventType(data,event);
    const currentType = data.types.find(item=>item.id===type.id);
    const values = eventFields(data,event);
    const amounts = [];
    for (const field of type.fields) {
      const lessonRate = type.id === 'lesson' && field.id === 'rate';
      const current = currentType?.fields.find(item=>item.id===field.id);
      if (field.type !== 'number' || !(current?.metric ?? field.metric ?? lessonRate)) continue;
      const unit = (field.metric ? field.metricUnit : current?.metricUnit)?.trim() || (lessonRate ? '₽' : '');
      const id = JSON.stringify([type.id,field.id,unit]);
      if (!metrics.has(id)) metrics.set(id,{
        id, label:lessonRate ? 'Начислено за уроки' : field.label, typeName:type.name,
        unit, total:0, count:0, missing:0,
      });
      const metric = metrics.get(id), value = values[field.id];
      const amount = value == null || String(value).trim() === '' ? NaN : Number(value);
      amounts.push({id,label:metric.label,unit,value:Number.isFinite(amount) ? amount : null});
      if (Number.isFinite(amount)) {
        metric.total += amount;
        metric.count++;
      } else metric.missing++;
    }
    contributions.set(event.id,amounts);
  }
  return {entries,minutes,metrics:[...metrics.values()],contributions};
}

export const eventRecordId = event => event.recordId || event.studentId || event.snapshot?.record?.id || '';

function reportField(type, historical, currentType) {
  const current = currentType?.fields.find(field=>field.id===historical.id && field.type===historical.type);
  const unit = historical.type==='number'
    ? (historical.metric ? historical.metricUnit : current?.metricUnit || historical.metricUnit)?.trim() ||
      (type.id==='lesson' && historical.id==='rate' ? '₽' : '')
    : '';
  return {
    ...(current || historical), typeId:type.id, typeName:currentType?.name || type.name, unit,
    key:JSON.stringify([type.id,historical.id,historical.type,unit]),
  };
}

export function reportRows(data, from, to) {
  const currentTypes = new Map(data.types.map(type=>[type.id,type]));
  return reportableEvents(data).filter(event=>event.status==='done' && event.date && event.date>=from && event.date<=to)
    .sort((a,b)=>b.date.localeCompare(a.date)||b.start-a.start)
    .map(event=>{
      const type = eventType(data,event);
      const fields = new Map(type.fields.map(field=>{
        const descriptor = reportField(type,field,currentTypes.get(type.id));
        return [descriptor.key,descriptor];
      }));
      return {event,recordId:eventRecordId(event),type,fields,values:eventFields(data,event)};
    });
}

export function reportFields(rows) {
  const fields = new Map();
  for (const row of rows) for (const [key,field] of row.fields) {
    if (!fields.has(key)) fields.set(key,field);
  }
  return [...fields.values()].sort((a,b)=>a.typeName.localeCompare(b.typeName,'ru')||a.label.localeCompare(b.label,'ru'));
}

const isFilled = value => value != null && (Array.isArray(value) ? value.length>0 : typeof value!=='string' || value.trim()!=='');
const fieldValue = (row,field) => row.values[field.id];
const applies = (row,field) => row.fields.has(field.key);

export function matchesReportFilter(row, field, filter) {
  if (!applies(row,field)) return false;
  const value = fieldValue(row,field), filled = isFilled(value);
  if (filter.operator==='filled') return filled;
  if (filter.operator==='empty') return !filled;
  if (!filled) return false;
  if (filter.operator==='range') {
    const measure = field.type==='number' ? Number(value) : value;
    if (field.type==='number' && !Number.isFinite(measure)) return false;
    const start = field.type==='number' ? Number(filter.first) : filter.first;
    const end = field.type==='number' ? Number(filter.last) : filter.last;
    return (!filter.first || measure>=start) && (!filter.last || measure<=end);
  }
  if (filter.operator==='contains') return String(value).toLocaleLowerCase('ru').includes(filter.first.trim().toLocaleLowerCase('ru'));
  if (field.type==='checkbox') return value === (filter.first==='true');
  return Array.isArray(value) ? value.includes(filter.first) : String(value)===filter.first;
}

export function reportMeasure(rows, fields, operation) {
  if (operation==='events') return {value:rows.length,missing:0};
  if (operation==='duration') return {value:rows.reduce((total,{event})=>total+event.duration,0),missing:0};
  let count=0, missing=0, total=0, min=Infinity, max=-Infinity;
  for (const row of rows) for (const field of fields) {
    if (!applies(row,field)) continue;
    const raw = fieldValue(row,field);
    const value = isFilled(raw) ? Number(raw) : NaN;
    if (!Number.isFinite(value)) {missing++;continue;}
    count++;
    total+=value;
    min=Math.min(min,value);
    max=Math.max(max,value);
  }
  if (operation==='filled') return {value:count,missing};
  if (!count) return {value:null,missing};
  return {value:{sum:total,average:total/count,min,max}[operation],missing};
}

export const reportValue = (row,field) => applies(row,field) ? fieldValue(row,field) : undefined;
export function reportGroups(rows, group, names, field) {
  if (!group) return [];
  const groups = new Map();
  for (const row of rows) {
    const {event,recordId,type} = row;
    let labels;
    if (group==='record') labels = [[recordId,names.get(recordId) || 'Без записи']];
    else if (group==='type') labels = [[type.id,type.name]];
    else if (group==='place') {
      const place = event.location;
      labels = Number.isFinite(place?.lat) && Number.isFinite(place?.lng) ?
        [[`${place.lat.toFixed(5)}:${place.lng.toFixed(5)}`,place.label || place.address || 'Место без названия']] : [['','Без места']];
    } else if (group==='day') labels = [[event.date,event.date.split('-').reverse().join('.')]];
    else {
      if (!field || !applies(row,field)) continue;
      const value = fieldValue(row,field);
      if (!isFilled(value)) labels = [[null,'Не заполнено']];
      else if (field.type==='checkbox') labels = [[value,value ? 'Да' : 'Нет']];
      else labels = (Array.isArray(value) ? [...new Set(value)] : [value]).map(item=>[item,String(item)]);
    }
    for (const [id,label] of labels) {
      if (!groups.has(id)) groups.set(id,{id,label,rows:[]});
      groups.get(id).rows.push(row);
    }
  }
  return [...groups.values()].sort((a,b)=>b.rows.length-a.rows.length || a.label.localeCompare(b.label,'ru'));
}
