import { Field } from './UI.jsx';
export function TimingFields({ values, onChange }) {
  return <><Field label="Начало" type="time" value={values.start} onChange={value => onChange('start', value)} required/><Field label="Конец" type="time" value={values.end} onChange={value => onChange('end', value)} required/><Field label="Длительность, мин" type="number" value={values.duration} onChange={value => onChange('duration', value)} required min="5" max="1440" step="1"/>{values.end === '00:00' && Number(values.duration) > 0 && <small class="timing-midnight">00:00 — полночь в конце выбранного дня</small>}</>;
}
