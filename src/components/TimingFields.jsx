import { Field } from './UI.jsx';
import { TimeInput } from './TimeInput.jsx';
export function TimingFields({ values, onChange }) {
  return <><Field label="Начало"><TimeInput label="Начало" value={values.start} onChange={value => onChange('start', value)} required/></Field><Field label="Конец"><TimeInput label="Конец" value={values.end} onChange={value => onChange('end', value)} required/></Field><Field label="Длительность, мин" type="number" value={values.duration} onChange={value => onChange('duration', value)} required min="5" max="1440" step="1"/>{values.end === '00:00' && Number(values.duration) > 0 && <small class="timing-midnight">00:00 — полночь в конце выбранного дня</small>}</>;
}
