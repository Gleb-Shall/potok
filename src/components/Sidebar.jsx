import { Brand } from './Brand.jsx';
import { Icon } from './Icon.jsx';
import { initials } from './UI.jsx';

const SECTIONS = [
  ['schedule', 'calendar', 'Расписание'],
  ['students', 'users', 'Записи'],
  ['types', 'sliders', 'Шаблоны'],
  ['transfers', 'arrows', 'Переносы'],
  ['history', 'history', 'История'],
];

export function Sidebar({ collapsed, onToggle, view, onChange, pending, account, onSignIn, onHome }) {
  const toggleLabel = collapsed ? 'Развернуть боковую панель' : 'Свернуть боковую панель';
  const name = account.user?.displayName || account.user?.email || 'Моё расписание';
  return <aside class="sidebar" aria-label="Боковая панель">
    <div class="sidebar-header">
      <Brand href={onHome ? '/' : '#'} onClick={event => { event.preventDefault(); if (onHome) onHome(); else onChange('schedule'); }}/>
      <button type="button" class="sidebar-toggle" aria-label={toggleLabel} aria-expanded={!collapsed} aria-controls="workspace-navigation" data-tooltip={toggleLabel} onClick={onToggle}><Icon name="sidebar"/></button>
    </div>
    <div class="workspace-label">ЛИЧНОЕ ПРОСТРАНСТВО</div>
    <nav id="workspace-navigation" aria-label="Разделы">{SECTIONS.map(([id, icon, label]) => <button type="button" key={id} class={`nav-item ${view === id ? 'active' : ''}`} aria-label={label} data-tooltip={label} aria-current={view === id ? 'page' : undefined} onClick={() => onChange(id)}>
      <Icon name={icon}/><span class="sidebar-label">{label}</span>{id === 'transfers' && pending > 0 && <span class="nav-count amber" aria-hidden="true">{pending}</span>}
    </button>)}</nav>
    <div class="sidebar-note"><span class="tiny-spark">✳</span><p>Освободи голову.<br/>Планы уже здесь.</p></div>
    <div class="sidebar-bottom">
      <button type="button" class={`nav-item ${view === 'settings' ? 'active' : ''}`} aria-label="Настройки" aria-current={view === 'settings' ? 'page' : undefined} data-tooltip="Настройки" onClick={() => onChange('settings')}><Icon name="settings"/><span class="sidebar-label">Настройки</span></button>
      <button type="button" class="sidebar-profile" aria-label={`Аккаунт: ${name}`} data-tooltip={name} onClick={() => onChange('settings')}><span class="account-avatar">{account.user ? initials(name) : 'Я'}</span><span class="sidebar-profile-copy"><strong>{name}</strong><small><span class="status-dot"/>{account.user ? 'Google-аккаунт' : 'На этом устройстве'}</small></span></button>
      {!account.user && <button type="button" class="sidebar-signin" aria-label="Войти через Google" data-tooltip="Войти через Google" disabled={account.loading} onClick={onSignIn}><Icon name="login"/><span class="sidebar-label">{account.loading ? 'Подключение…' : 'Войти через Google'}</span></button>}
    </div>
  </aside>;
}
