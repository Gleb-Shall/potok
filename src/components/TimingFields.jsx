import { addDays, timeToMinutes } from '../lib/domain.js';
import { endsNextDay, eventEnd } from '../lib/timing.js';
import { Field, dateLabel } from './UI.jsx';
import { TimeInput } from './TimeInput.jsx';
export function TimingFields({ values, onChange, durationLabel = 'Длительность, мин' }) {
  const nextDay = values.date && eventEnd(values.start,values.duration) && endsNextDay(timeToMinutes(values.start),Number(values.duration));
  return <><Field label="Начало"><TimeInput label="Начало" value={values.start} onChange={value => onChange('start', value)} required/></Field><Field label="Конец"><TimeInput label="Конец" value={values.end} onChange={value => onChange('end', value)} required/></Field><Field label={durationLabel} aria-label="Длительность, мин" type="number" value={values.duration} onChange={value => onChange('duration', value)} required min="5" max="1440" step="1"/>{nextDay && <small class="timing-midnight">Окончание {dateLabel(addDays(values.date,1))} в {values.end}</small>}</>;
}
