import { useState } from 'preact/hooks';
import { createPortal, lazy, Suspense } from 'preact/compat';
import { Modal } from './UI.jsx';
import { Icon } from './Icon.jsx';

const MapPicker = lazy(() => import('./MapPicker.jsx'));
export function LocationField({ value, onChange, data }) {
  const [open, setOpen] = useState(false);
  return <div class="location-field"><button type="button" class="location-trigger" aria-haspopup="dialog" aria-expanded={open} title={value?.address || undefined} onClick={() => setOpen(true)}><Icon name="pin"/><span>{value?.label || 'Добавить место'}</span></button>
    {value && <button type="button" class="icon-button location-remove" aria-label="Убрать место" onClick={() => onChange(null)}><Icon name="close"/></button>}
    {open && createPortal(<Suspense fallback={<Modal title="Загружаю карту…" onClose={() => setOpen(false)}/>}><MapPicker value={value} saved={[...data.events, ...data.series].map(item => item.location)} onChange={onChange} onClose={() => setOpen(false)}/></Suspense>, document.body)}
  </div>;
}
