import { useRef, useState } from 'preact/hooks';
import { ThemeToggler } from '@animate-ui/react/primitives/effects/theme-toggler';
import { useTheme } from '../theme/ThemeProvider.jsx';
import { Icon } from './Icon.jsx';

const modes = [['light', 'sun', 'Светлая'], ['dark', 'moon', 'Тёмная'], ['system', 'monitor', 'Как в системе']];
export function ThemeControl({ settings = false }) {
  const { theme, resolved, setTheme } = useTheme();
  const busyRef = useRef(false);
  const [busy, setBusy] = useState(false);
  const commit = value => { setTheme(value); busyRef.current = false; setBusy(false); };
  return <ThemeToggler theme={theme} resolvedTheme={resolved} setTheme={commit} direction="ltr">{({ toggleTheme }) => {
    const change = value => {
      if (busyRef.current) return;
      busyRef.current = true; setBusy(true);
      // Commit immediately if the browser refuses a View Transition.
      Promise.resolve(toggleTheme(value)).catch(() => commit(value));
    };
    return settings ? <div class="theme-settings"><h3>Оформление</h3><p>Выбери тему. Режим «Как в системе» следует настройкам устройства.</p><div class="theme-options" role="group" aria-label="Тема оформления">{modes.map(([value, icon, label]) => <button key={value} type="button" disabled={busy} aria-pressed={theme === value} onClick={() => change(value)}><Icon name={icon}/>{label}</button>)}</div></div> : <button type="button" class="theme-toggle" disabled={busy} aria-label={resolved === 'dark' ? 'Включить светлую тему' : 'Включить тёмную тему'} title={resolved === 'dark' ? 'Светлая тема' : 'Тёмная тема'} aria-pressed={resolved === 'dark'} onClick={() => change(resolved === 'dark' ? 'light' : 'dark')}><span class="theme-toggle-icon" key={resolved}><Icon name={resolved === 'dark' ? 'moon' : 'sun'}/></span></button>;
  }}</ThemeToggler>;
}
