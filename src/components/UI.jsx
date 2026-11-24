import { cloneElement, createContext } from 'preact';
import { useEffect, useRef, useId, useContext } from 'preact/hooks';
import { Icon } from './Icon.jsx';
import { COLOR_NAMES } from '../lib/events.js';

export const dateLabel = (date, options = {}) => date ? new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', timeZone: 'UTC', ...options }).format(new Date(date + 'T00:00:00Z')) : 'Без даты';
export const money = value => new Intl.NumberFormat('ru-RU').format(value || 0) + ' ₽';
export const initials = name => (name || '?').split(/\s+/).slice(0, 2).map(item => item[0]).join('');
export const dayNames = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
export const longDays = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
export const SaveErrorContext = createContext('');
export function Button({ children, icon, kind = 'secondary', ...props }) { return <button type="button" class={`button ${kind}`} {...props}>{icon && <Icon name={icon}/>}{children}</button>; }
export function Field({ label, value, onChange, type = 'text', children, id, ...props }) {
  const fieldId = useId();
  const controlId = children?.props?.id ?? id ?? fieldId;
  return <label class="field" htmlFor={controlId}><span>{label}</span>{children ? cloneElement(children, { id: controlId }) : (type === 'textarea'
    ? <textarea id={controlId} value={value ?? ''} onInput={event => onChange(event.currentTarget.value)} {...props}/>
    : <input id={controlId} type={type} value={value ?? ''} onInput={event => onChange(event.currentTarget.value)} {...props}/>)}</label>;
}
export function Select({ label, value, onChange, children, ...props }) { return <Field label={label}><select value={value} onChange={event => onChange(event.currentTarget.value)} {...props}>{children}</select></Field>; }
export function Check({ children, checked, onChange, id, ...props }) {
  const fieldId = useId();
  const controlId = id ?? fieldId;
  return <label class="check-label editor-check" htmlFor={controlId}><input id={controlId} type="checkbox" checked={checked} onChange={event => onChange(event.currentTarget.checked)} {...props}/><span>{children}</span></label>;
}
export function Colors({ value, onChange }) { return <fieldset class="color-field"><legend>Цвет карточки</legend>{Object.entries(COLOR_NAMES).map(([color, name]) => <label key={color} class={`color-option color-${color}`}><input name="color" type="radio" value={color} checked={value === color} onChange={() => onChange(color)}/><span class="sr-only">{name}</span></label>)}</fieldset>; }

function isOutsideDialog(event) {
  if (event.target !== event.currentTarget) return false;
  const { left, right, top, bottom } = event.currentTarget.getBoundingClientRect();
  return event.clientX < left || event.clientX > right || event.clientY < top || event.clientY > bottom;
}

export function Modal({ title, subtitle, eyebrow, onClose, children, wide = false, className = '', fullscreen = false, onEscape, panel = false, onOpen, anchor }) {
  const ref = useRef(null);
  const pressedOutside = useRef(false);
  const titleId = useId();
  const subtitleId = subtitle ? `${titleId}-description` : undefined;
  const saveError = useContext(SaveErrorContext);
  useEffect(() => { const dialog = ref.current; dialog.showModal(); onOpen?.(dialog); return () => dialog.close(); }, []);
  useEffect(() => {
    if (!anchor) return;
    const dialog = ref.current;
    const place = () => {
      const gap = 12;
      const {left, right, top, bottom} = anchor.getBoundingClientRect();
      const width = dialog.offsetWidth, height = dialog.offsetHeight;
      const maxX = Math.max(gap, window.innerWidth-width-gap);
      const maxY = Math.max(gap, window.innerHeight-height-gap);
      let x = right + gap, y = top;
      if (x > maxX) {
        x = left - width - gap;
        if (x < gap) {
          x = left;
          const below = window.innerHeight-bottom, above = top;
          y = below >= height+gap || below >= above ? bottom+gap : top-height-gap;
        }
      }
      dialog.style.setProperty('--dialog-x', `${Math.max(gap,Math.min(x,maxX))}px`);
      dialog.style.setProperty('--dialog-y', `${Math.max(gap,Math.min(y,maxY))}px`);
    };
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(place) : null;
    observer?.observe(dialog);
    observer?.observe(anchor);
    window.addEventListener('resize',place);
    place();
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize',place);
      dialog.style.removeProperty('--dialog-x');
      dialog.style.removeProperty('--dialog-y');
    };
  },[anchor]);
  const heading = <>
    {eyebrow && <p class="eyebrow">{eyebrow}</p>}
    <h2 id={titleId}>{title}</h2>
    {subtitle && <p id={subtitleId} class="modal-subtitle">{subtitle}</p>}
  </>;
  return <dialog ref={ref}
    class={`${wide ? 'wide-modal' : ''} ${className} ${fullscreen ? 'is-fullscreen' : ''} ${panel ? 'panel-dialog' : ''} ${anchor ? 'is-anchored' : ''}`}
    aria-labelledby={titleId} aria-describedby={subtitleId}
    onCancel={event => { event.preventDefault(); (onEscape ?? onClose)(); }}
    onPointerDown={event => { pressedOutside.current = event.button === 0 && isOutsideDialog(event); }}
    onPointerCancel={() => { pressedOutside.current = false; }}
    onClick={event => {
      const dismiss = pressedOutside.current && isOutsideDialog(event);
      pressedOutside.current = false;
      if (dismiss) onClose();
    }}>
    <button type="button" class="modal-close icon-button" aria-label="Закрыть окно" onClick={onClose}><Icon name="close"/></button>
    {panel ? <header class="panel-heading">{heading}</header> : heading}
    {saveError && <p class="dialog-save-error" role="alert">{saveError}</p>}
    {children}
  </dialog>;
}
export function FormFooter({ onClose, label = 'Сохранить', disabled, children }) { return <div class="modal-footer">{children}<Button onClick={onClose}>Отмена</Button><button type="submit" class="button primary" disabled={disabled}>{label}</button></div>; }
export function ErrorMessage({ error }) { return error ? <p class="form-error" role="alert">{error}</p> : null; }
export function Search({ value, onChange, placeholder = 'Поиск событий', label = placeholder }) { return <label class="search-field"><Icon name="search"/><input type="search" value={value} onInput={event => onChange(event.currentTarget.value)} placeholder={placeholder} aria-label={label}/></label>; }
