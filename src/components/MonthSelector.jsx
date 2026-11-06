import { monthStart } from '../lib/domain.js';
import { Icon } from './Icon.jsx';

const months = Array.from({length:12},(_,index)=>new Intl.DateTimeFormat('ru',{month:'long',timeZone:'UTC'}).format(new Date(Date.UTC(2000,index,1))));
export function MonthSelector({ value, onChange, label = 'Период' }) {
  const [year,month] = value.split('-');
  const years = Array.from({length:21},(_,index)=>Number(year)-10+index);
  return <div class="month-selector" role="group" aria-label={label}>
    <button type="button" class="icon-button" aria-label={`Предыдущий месяц: ${label}`} onClick={()=>onChange(monthStart(`${value}-01`,-1).slice(0,7))}><Icon name="left"/></button>
    <select aria-label={`Месяц: ${label}`} value={month} onChange={event=>onChange(`${year}-${event.currentTarget.value}`)}>{months.map((name,index)=><option key={name} value={String(index+1).padStart(2,'0')}>{name}</option>)}</select>
    <select aria-label={`Год: ${label}`} value={year} onChange={event=>onChange(`${event.currentTarget.value}-${month}`)}>{years.map(item=><option key={item} value={item}>{item}</option>)}</select>
    <button type="button" class="icon-button" aria-label={`Следующий месяц: ${label}`} onClick={()=>onChange(monthStart(`${value}-01`,1).slice(0,7))}><Icon name="right"/></button>
  </div>;
}
