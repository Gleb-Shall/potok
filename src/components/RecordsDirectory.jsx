import { useState } from 'preact/hooks';
import { Icon } from './Icon.jsx';
import { Button, Search, Select, initials } from './UI.jsx';
import { allRecords, fieldDisplay, RECORD_KINDS } from '../lib/events.js';

const collator = new Intl.Collator('ru',{numeric:true,sensitivity:'base'});
const plural = new Intl.PluralRules('ru');
const scheduleWord = count => ({one:'расписание',few:'расписания',many:'расписаний',other:'расписаний'})[plural.select(count)];
const normalized = value => String(value).normalize('NFKC').toLocaleLowerCase('ru').replaceAll('ё','е');
const words = value => normalized(value).match(/[\p{L}\p{N}]+/gu) || [];

export function RecordsDirectory({data,query,onQuery,filter,onFilter,onOpen,onAdd,today}) {
  const [repeatFilter,setRepeatFilter] = useState('');
  const records = allRecords(data);
  const categories = [...new Set(records.map(record=>record.kind))].sort((a,b)=>collator.compare(RECORD_KINDS[a] || a,RECORD_KINDS[b] || b));
  const category = categories.includes(filter) ? filter : '';
  const terms = words(query);
  const queryPhone = /^[+()\s\d.-]+$/.test(query) ? query.replace(/\D/g,'') : '';
  const scheduleCounts = new Map();
  for (const series of data.series) {
    const id = series.recordId || series.studentId;
    if (id && !series.archived && (!series.until || series.until>=today)) scheduleCounts.set(id,(scheduleCounts.get(id) || 0)+1);
  }
  const visible = records.filter(record=>{
    if (category && record.kind!==category) return false;
    if (repeatFilter && scheduleCounts.has(record.id)!==(repeatFilter==='scheduled')) return false;
    if (!terms.length) return true;
    const details = (record.details || []).flatMap(field=>[field.label,field.value]);
    const haystack = words([record.name,record.subject,record.subtitle,record.contact,...details].join(' ')).join(' ');
    if (terms.every(term=>haystack.includes(term))) return true;
    const phone = String(record.contact || '').replace(/\D/g,'');
    return queryPhone.length>=3 && phone.includes(queryPhone);
  }).sort((a,b)=>collator.compare(a.name,b.name));
  const hasFilters = Boolean(query.trim() || category || repeatFilter);
  const reset = () => {onQuery('');onFilter('');setRepeatFilter('');};
  return <section class="students-panel record-directory">
    <header class="section-actions">
      <h2>Записи</h2>
      <Button kind="primary" icon="plus" onClick={onAdd}>Добавить запись</Button>
    </header>
    <div class="record-filter-toolbar" role="group" aria-label="Поиск и фильтры записей">
      <Search value={query} onChange={onQuery} placeholder="Имя, контакт или поле записи"/>
      <Select label="Шаблон записи" value={category} onChange={onFilter}>
        <option value="">Все шаблоны</option>
        {categories.map(kind=><option key={kind} value={kind}>{RECORD_KINDS[kind] || kind}</option>)}
      </Select>
      <Select label="Повторы" value={repeatFilter} onChange={setRepeatFilter}>
        <option value="">Все записи</option><option value="scheduled">Есть повторы</option><option value="unscheduled">Без повторов</option>
      </Select>
    </div>
    <div class="record-filter-results">
      <span role="status">Найдено {visible.length} из {records.length}</span>
      {hasFilters && <Button kind="text-button" onClick={reset}>Сбросить</Button>}
    </div>
    {visible.length>0 && <>
      <div class="records-list-head" aria-hidden="true"><span>Имя или название</span><span>Шаблон записи</span><span>Сведения</span><span>Повторы</span></div>
      <div class="records-list">{visible.map(record=>{
        const count = scheduleCounts.get(record.id) || 0;
        const firstField = record.details?.[0];
        const context = firstField?.label ? `${firstField.label}: ${firstField.type==='url' ? 'Ссылка' : fieldDisplay(firstField,firstField.value)}` : record.contact || 'Сведения не добавлены';
        return <button key={record.id} class="student-tile record-list-row" onClick={()=>onOpen(record)}>
          <span class="record-list-identity"><span class={`record-initials color-${record.color}`}>{initials(record.name)}</span>
            <span><strong>{record.name}</strong><small>{record.subject || record.subtitle || 'Общие сведения'}</small></span>
          </span>
          <span class="record-list-kind">{RECORD_KINDS[record.kind] || record.kind}</span>
          <span class="record-list-context">{context}</span>
          <span class="record-list-count">{count ? `${count} ${scheduleWord(count)}` : 'Нет повторов'}<Icon name="right"/></span>
        </button>;
      })}</div>
    </>}
    {!visible.length && <div class="empty-state">
      <h3>{records.length ? 'Записи не найдены' : 'Добавь первую запись'}</h3>
      <p>{records.length ? 'Попробуй изменить запрос или сбросить фильтры.' : 'Запись можно связать с одним или несколькими событиями.'}</p>
    </div>}
  </section>;
}
