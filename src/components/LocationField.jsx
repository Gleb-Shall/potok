import { useState } from 'preact/hooks';
import { createPortal, lazy, Suspense } from 'preact/compat';
import { Modal } from './UI.jsx';
import { Icon } from './Icon.jsx';

const MapPicker = lazy(() => import('./MapPicker.jsx'));
export function LocationField({ value, onChange, data }) {
  const [open, setOpen] = useState(false);
  return <div class="location-field"><button type="button" class="location-trigger" onClick={() => setOpen(true)}><span class="place-result-pin"><Icon name="pin"/></span><span><strong>{value?.label || 'Добавить место'}</strong><small>{value?.address || (value ? 'Изменить точку на карте' : 'Выбрать на карте или найти адрес')}</small></span><Icon name="right"/></button>
    {value && <button type="button" class="text-button" onClick={() => onChange(null)}>Убрать место</button>}
    {open && createPortal(<Suspense fallback={<Modal title="Загружаю карту…" onClose={() => setOpen(false)}/>}><MapPicker value={value} saved={[...data.events, ...data.series].map(item => item.location)} onChange={onChange} onClose={() => setOpen(false)}/></Suspense>, document.body)}
  </div>;
}
