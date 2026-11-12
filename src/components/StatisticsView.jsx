import { useMemo, useRef, useState } from 'preact/hooks';
import { lazy, Suspense } from 'preact/compat';
import { getRecord } from '../lib/events.js';
import { matchesReportFilter, recordStatisticsOptions, reportFields, reportFilterFields, reportGroups, reportMeasure, reportRows, reportValue, summarizeEvents } from '../lib/statistics.js';
import { addDays, monthStart, todayISO } from '../lib/domain.js';
import { ActivityTime, EventListRow } from './EventListRow.jsx';
import { MonthSelector } from './MonthSelector.jsx';
import { Button, Field, Select } from './UI.jsx';

const MapView = lazy(()=>import('./MapView.jsx'));
const number = new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2});
const hours = minutes => [Math.floor(minutes/60) && `${Math.floor(minutes/60)} ч`, minutes%60 && `${minutes%60} мин`].filter(Boolean).join(' ') || '0 ч';
const quantity = (value,unit) => `${number.format(value)}${unit ? ` ${unit}` : ''}`;
const calculations = {sum:'Сумма',average:'Среднее',min:'Минимум',max:'Максимум',filled:'Количество заполненных'};
const blankRule = id => ({id,key:'',operator:'filled',first:'',last:''});
const fieldLabel = field => `${field.typeName} → ${field.label}${field.unit && !field.label.includes(field.unit) ? ` (${field.unit})` : ''}`;
const groupedTypes = new Set(['select','multiselect','checkbox','date','text']);
const filterTypes = {number:['range','Диапазон'],date:['range','Диапазон'],text:['contains','Содержит'],textarea:['contains','Содержит'],url:['contains','Содержит']};

function isActiveRule({key,operator,first,last}) {
  return Boolean(key && (operator==='filled' || operator==='empty' || first.trim() || (operator==='range' && last)));
}

function ReportFilter({rule,field,fields,rows,onChange,onRemove}) {
  const [operator,label] = filterTypes[field?.type] || ['equals','Равно'];
  const options = field && ['select','multiselect'].includes(field.type)
    ? [...new Set([...(field.options || []), ...rows.flatMap(row => reportValue(row, field) ?? [])].filter(Boolean))]
    : [];
  return <div class="statistics-filter-row">
    <Select label="Поле для фильтра" value={rule.key} onChange={key=>onChange({...blankRule(rule.id),key})}>
      <option value="">Выбери поле</option>
      {rule.key && !fields.some(item=>item.key===rule.key) && <option value={rule.key}>Поле вне выборки</option>}
      {fields.map(item=><option key={item.key} value={item.key}>{fieldLabel(item)}</option>)}
    </Select>
    {field && <Select label="Условие" value={rule.operator} onChange={operator=>onChange({...rule,operator,first:'',last:''})}>
      <option value="filled">Заполнено</option><option value="empty">Пусто</option><option value={operator}>{label}</option>
    </Select>}
    {field && rule.operator==='range' && <>
      <Field label="От" type={field.type} step={field.type==='number' ? 'any' : undefined} value={rule.first} onChange={first=>onChange({...rule,first})}/>
      <Field label="До" type={field.type} step={field.type==='number' ? 'any' : undefined} value={rule.last} onChange={last=>onChange({...rule,last})}/>
    </>}
    {field && rule.operator==='contains' && <Field label="Искать" value={rule.first} onChange={first=>onChange({...rule,first})}/>}
    {field && rule.operator==='equals' && <Select label="Значение" value={rule.first} onChange={first=>onChange({...rule,first})}>
      <option value="">Выбери значение</option>
      {field.type==='checkbox' ? <><option value="true">Да</option><option value="false">Нет</option></> :
        options.map(value=><option key={value} value={value}>{value}</option>)}
    </Select>}
    <Button icon="close" aria-label="Удалить условие" title="Удалить условие" onClick={onRemove}/>
  </div>;
}

export function StatisticsView({data, now, onOpen, onGuide}) {
  const [month,setMonth] = useState(()=>todayISO(new Date(now)).slice(0,7));
  const [custom,setCustom] = useState(false);
  const [range,setRange] = useState({from:'',to:''});
  const [recordId,setRecordId] = useState('');
  const [typeId,setTypeId] = useState('');
  const [rules,setRules] = useState([]);
  const nextRule = useRef(0);
  const [metric,setMetric] = useState('duration');
  const [operation,setOperation] = useState('sum');
  const [extra,setExtra] = useState([]);
  const [group,setGroup] = useState('');
  const [selectedGroup,setSelectedGroup] = useState(null);
  const [map,setMap] = useState(false);
  const from = custom ? range.from : month+'-01';
  const to = custom ? range.to : addDays(monthStart(from,1),-1);
  const validPeriod = Boolean(from && to && from<=to);
  const records = useMemo(()=>recordStatisticsOptions(data),[data]);
  const names = useMemo(()=>new Map(records.map(record=>[record.id,record.name])),[records]);
  const period = useMemo(()=>validPeriod ? reportRows(data,from,to) : [],[data,from,to,validPeriod]);
  const types = new Map(data.types.map(type=>[type.id,type.name]));
  for (const row of period) if (!types.has(row.type.id)) types.set(row.type.id,row.type.name);
  const recordCounts = new Map(), typeCounts = new Map();
  for (const row of period) {
    if (!typeId || row.type.id===typeId) recordCounts.set(row.recordId,(recordCounts.get(row.recordId)||0)+1);
    if (!recordId || row.recordId===recordId) typeCounts.set(row.type.id,(typeCounts.get(row.type.id)||0)+1);
  }
  const scope = useMemo(()=>period.filter(row=>(!recordId || row.recordId===recordId) && (!typeId || row.type.id===typeId)),[period,recordId,typeId]);
  const fields = useMemo(()=>reportFields(scope),[scope]);
  const byKey = useMemo(()=>new Map(fields.map(field=>[field.key,field])),[fields]);
  const filterFields = useMemo(() => reportFilterFields(scope, data.types.filter(type => !type.archived && (!typeId || type.id === typeId))), [scope, data.types, typeId]);
  const filterByKey = useMemo(() => new Map(filterFields.map(field => [field.key, field])), [filterFields]);
  const activeRules = rules.filter(isActiveRule);
  const filtered = activeRules.length ? scope.filter(row=>activeRules.every(rule=>{
    const field = filterByKey.get(rule.key);
    return field && matchesReportFilter(row,field,rule,data);
  })) : scope;
  const entries = filtered.map(row=>row.event);
  const {minutes,metrics,contributions} = summarizeEvents(data,entries);
  const primary = byKey.get(metric);
  const mode = primary ? operation : metric==='events' || metric==='duration' ? metric : 'unavailable';
  const numericFields = fields.filter(field=>field.type==='number');
  const selectedFields = primary ? [primary,...extra.map(key=>byKey.get(key)).filter(field=>field && primary.unit && field.unit===primary.unit)] : [];
  const unit = mode==='filled' ? '' : primary?.unit;
  const display = value => value == null ? '—' : mode==='duration' ? hours(value) : quantity(value,unit);
  const result = mode==='unavailable' ? {value:null,missing:0} : reportMeasure(filtered,selectedFields,mode);
  const groups = reportGroups(filtered,group,names,byKey.get(group));
  const chosen = selectedGroup && groups.find(item=>item.id===selectedGroup.id);
  const listRows = chosen?.rows || filtered;
  const list = listRows.map(row=>row.event);
  const clearGroup = change => value => {change(value);setSelectedGroup(null);};
  const openMapEvent = id => {const event=list.find(item=>item.id===id);if(event) onOpen(event);};
  return <section class="statistics-view" aria-label="Статистика событий">
    <header class="statistics-toolbar"><h2>Статистика</h2>{onGuide && <Button kind="text-button" onClick={onGuide}>Руководство</Button>}</header>
    <section class="statistics-controls" aria-label="Выборка отчёта">
      <div class="statistics-period">
        {custom ? <>
          <Field label="Дата с" type="date" value={range.from} onChange={from=>{setRange({...range,from});setSelectedGroup(null);}}/>
          <Field label="Дата по" type="date" value={range.to} onChange={to=>{setRange({...range,to});setSelectedGroup(null);}}/>
        </> : <MonthSelector value={month} onChange={clearGroup(setMonth)} label="Период отчёта"/>}
        <Button kind="text-button" onClick={()=>{if(!custom)setRange({from,to});setCustom(!custom);setSelectedGroup(null);}}>{custom ? 'По месяцам' : 'Выбрать даты'}</Button>
      </div>
      {!validPeriod && <p class="form-error" role="status">Укажи начало и конец периода по порядку.</p>}
      <div class="statistics-facets">
        <Select label="Запись" aria-label="Запись для статистики" value={recordId} onChange={clearGroup(setRecordId)}>
          <option value="">Все записи</option>
          {records.filter(record=>recordCounts.has(record.id)||record.id===recordId).map(record=><option key={record.id} value={record.id}>{record.name} · {recordCounts.get(record.id)||0}</option>)}
        </Select>
        <Select label="Шаблон события" value={typeId} onChange={clearGroup(setTypeId)}>
          <option value="">Все шаблоны</option>
          {[...types].filter(([id])=>typeCounts.has(id)||id===typeId).map(([id,name])=><option key={id} value={id}>{name} · {typeCounts.get(id)||0}</option>)}
        </Select>
      </div>
      <details class="statistics-advanced"><summary>Уточнить выборку {activeRules.length>0 && <span class="section-count">{activeRules.length}</span>}</summary>
        {rules.map(rule=><ReportFilter key={rule.id} rule={rule} field={filterByKey.get(rule.key)} fields={filterFields} rows={scope} onChange={next=>{setRules(rules.map(item=>item.id===next.id?next:item));setSelectedGroup(null);}} onRemove={()=>{setRules(rules.filter(item=>item.id!==rule.id));setSelectedGroup(null);}}/>)}
        <Button icon="plus" onClick={()=>setRules(current=>[...current,blankRule(++nextRule.current)])}>Добавить условие</Button>
      </details>
    </section>
    <dl class="statistics-totals">
      <div><dt>Проведённые события</dt><dd>{number.format(entries.length)}</dd></div>
      <div><dt>Общее время</dt><dd>{hours(minutes)}</dd></div>
      {metrics.map(item=><div key={item.id}><dt>{item.label}</dt><dd>{item.count ? quantity(item.total,item.unit) : '—'}</dd>
        <small>{item.typeName}{item.missing > 0 && ` · Без значения: ${item.missing}`}</small>
      </div>)}
    </dl>
    <section class="statistics-analysis" aria-label="Конструктор отчёта">
      <header class="activity-section-heading"><h2>Свой отчёт</h2></header>
      <div class="statistics-facets">
        <Select label="Что считать" value={metric} onChange={key=>{setMetric(key);setExtra([]);setOperation('sum');}}>
          <option value="duration">Длительность</option><option value="events">Количество событий</option>
          {mode==='unavailable' && <option value={metric}>Поле вне выборки</option>}
          {numericFields.map(field=><option key={field.key} value={field.key}>{fieldLabel(field)}</option>)}
        </Select>
        {primary && <Select label="Как считать" value={operation} onChange={setOperation}>
          {Object.entries(calculations).map(([id,label])=><option key={id} value={id}>{label}</option>)}
        </Select>}
        <Select label="Разбить по" value={group} onChange={clearGroup(setGroup)}>
          <option value="">Без разбивки</option><option value="record">Записям</option><option value="type">Шаблонам событий</option><option value="day">Дням</option><option value="place">Местам</option>
          {group && !['record','type','day','place'].includes(group) && !byKey.has(group) && <option value={group}>Поле вне выборки</option>}
          {fields.filter(field=>groupedTypes.has(field.type)).map(field=><option key={field.key} value={field.key}>{fieldLabel(field)}</option>)}
        </Select>
      </div>
      {primary?.unit && numericFields.some(field=>field.key!==primary.key && field.unit===primary.unit && !extra.includes(field.key)) &&
        <Select label="Добавить поле с той же единицей" value="" onChange={key=>{if(key)setExtra([...extra,key]);}}>
          <option value="">Выбери поле</option>{numericFields.filter(field=>field.key!==primary.key && field.unit===primary.unit && !extra.includes(field.key)).map(field=><option key={field.key} value={field.key}>{fieldLabel(field)}</option>)}
        </Select>}
      {extra.map(key=><Button key={key} kind="text-button" icon="close" onClick={()=>setExtra(extra.filter(item=>item!==key))}>{byKey.has(key) ? fieldLabel(byKey.get(key)) : 'Поле вне выборки'}</Button>)}
      <p class="statistics-result"><span>{primary ? calculations[operation] : 'Итого'}</span><strong>{display(result.value)}</strong>{result.missing>0 && <small>Без значения: {result.missing}</small>}</p>
      {group && !['record','type','day','place'].includes(group) && <p class="quiet-note">{byKey.get(group)?.type==='multiselect' ? 'Событие может быть в нескольких группах. В общем итоге оно учтено один раз.' : 'В разбивку входят события, в которых есть это поле шаблона.'}</p>}
      {groups.length>0 && <ul class="statistics-groups">{groups.map(item=><li key={JSON.stringify(item.id)}>
        <button type="button" aria-pressed={chosen===item} onClick={()=>setSelectedGroup(chosen===item?null:{id:item.id})}><span>{item.label}</span><small>{number.format(item.rows.length)} соб.</small><strong>{display(reportMeasure(item.rows,selectedFields,mode).value)}</strong></button>
      </li>)}</ul>}
    </section>
    <section class="statistics-events" aria-label="События за период">
      <header class="activity-section-heading statistics-list-heading"><h2>{chosen ? chosen.label : 'События за период'}</h2><span class="section-count">{list.length}</span>
        <div class="week-layout-switch" role="group" aria-label="Вид результатов"><button type="button" aria-pressed={!map} onClick={()=>setMap(false)}>Список</button><button type="button" aria-pressed={map} onClick={()=>setMap(true)}>Карта</button></div>
      </header>
      {map && list.some(event=>Number.isFinite(event.location?.lat) && Number.isFinite(event.location?.lng)) ?
        <Suspense fallback={<p>Загружаю карту…</p>}><MapView events={list} data={data} onOpen={openMapEvent} showTotals/></Suspense> :
        map ? <p class="activity-empty">В этой выборке у событий нет мест.</p> :
        list.length ? <div class="activity-list">{listRows.map(row=>{
          const {event,type} = row;
          const amounts = primary ? selectedFields.filter(field=>row.fields.has(field.key)).map(field=>({
            id:field.key,label:field.label,unit:field.unit,value:reportMeasure([row],[field],'sum').value,
          })) : contributions.get(event.id);
          return <EventListRow key={event.id} data={data} event={event} onOpen={onOpen}
          leading={<ActivityTime date={event.date} start={event.start} duration={event.duration}/>}
          meta={[types.get(type.id),getRecord(data,event)?.name].filter(Boolean).join(' · ')}
          trailing={<><span>{hours(event.duration)}</span>{amounts.map(item=><span key={item.id} class="statistics-amount" title={item.label}>{item.value === null ? 'Без значения' : quantity(item.value,item.unit)}</span>)}</>}/>;
        })}</div> :
        <p class="activity-empty">За выбранный период по этим фильтрам нет проведённых событий.</p>}
    </section>
  </section>;
}
