import { useEffect, useRef, useId } from 'preact/hooks';
import { Icon } from './Icon.jsx';
import { COLOR_NAMES } from '../lib/events.js';

export const dateLabel = (date, options = {}) => date ? new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', timeZone: 'UTC', ...options }).format(new Date(date + 'T00:00:00Z')) : 'Без даты';
export const money = value => new Intl.NumberFormat('ru-RU').format(value || 0) + ' ₽';
export const initials = name => (name || '?').split(/\s+/).slice(0, 2).map(item => item[0]).join('');
export const dayNames = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
export const longDays = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
export function Button({ children, icon, kind = 'secondary', ...props }) { return <button type="button" class={`button ${kind}`} {...props}>{icon && <Icon name={icon}/>}{children}</button>; }
export function Field({ label, value, onChange, type = 'text', children, ...props }) {
  return <label class="field"><span>{label}</span>{children || (type === 'textarea'
    ? <textarea value={value ?? ''} onInput={event => onChange(event.currentTarget.value)} {...props}/>
    : <input type={type} value={value ?? ''} onInput={event => onChange(event.currentTarget.value)} {...props}/>)}</label>;
}
export function Select({ label, value, onChange, children, ...props }) { return <Field label={label}><select value={value} onChange={event => onChange(event.currentTarget.value)} {...props}>{children}</select></Field>; }
export function Check({ children, checked, onChange, ...props }) { return <label class="check-label editor-check"><input type="checkbox" checked={checked} onChange={event => onChange(event.currentTarget.checked)} {...props}/><span>{children}</span></label>; }
export function Colors({ value, onChange }) { return <fieldset class="color-field"><legend>Цвет карточки</legend>{Object.entries(COLOR_NAMES).map(([color, name]) => <label key={color} class={`color-option color-${color}`}><input name="color" type="radio" value={color} checked={value === color} onChange={() => onChange(color)}/><span class="sr-only">{name}</span></label>)}</fieldset>; }
export function Modal({ title, subtitle, eyebrow, onClose, children, wide = false, className = '', fullscreen = false, onEscape }) {
  const ref = useRef(null);
  const titleId = useId();
  useEffect(() => { const dialog = ref.current; dialog.showModal(); return () => dialog.close(); }, []);
  return <dialog ref={ref} class={`${wide ? 'wide-modal' : ''} ${className} ${fullscreen ? 'is-fullscreen' : ''}`} aria-labelledby={titleId} onCancel={event => { if (onEscape) { event.preventDefault(); onEscape(); } else onClose(); }} onClick={event => {
    if (event.target !== event.currentTarget) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose();
  }}><button type="button" class="modal-close icon-button" aria-label="Закрыть окно" onClick={onClose}><Icon name="close"/></button>{eyebrow && <p class="eyebrow">{eyebrow}</p>}<h2 id={titleId}>{title}</h2>{subtitle && <p class="modal-subtitle">{subtitle}</p>}{children}</dialog>;
}
export function FormFooter({ onClose, label = 'Сохранить', children }) { return <div class="modal-footer">{children}<Button onClick={onClose}>Отмена</Button><button type="submit" class="button primary">{label}</button></div>; }
export function ErrorMessage({ error }) { return error ? <p class="form-error" role="alert">{error}</p> : null; }
export function Search({ value, onChange, placeholder = 'Поиск событий' }) { return <label class="search-field"><Icon name="search"/><input type="search" value={value} onInput={event => onChange(event.currentTarget.value)} placeholder={placeholder} aria-label={placeholder}/></label>; }
