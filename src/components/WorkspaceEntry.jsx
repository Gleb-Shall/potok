import { ThemeControl } from './ThemeControl.jsx';
import { Brand } from './Brand.jsx';
import { Icon } from './Icon.jsx';

export function WorkspaceEntry({ account, onSignIn, onRetry, onSignOut, onHome, onDemo }) {
  return <div class="workspace-entry"><header><Brand onClick={event => { if (onHome) { event.preventDefault(); onHome(); } }}/><a href="/demo" onClick={event => { if (onDemo) { event.preventDefault(); onDemo(); } }}>Сначала посмотреть демо <Icon name="right"/></a><ThemeControl/></header>
    <main><div class="entry-illustration" aria-hidden="true"><span class="entry-orbit"/><span class="entry-orbit second"/><span class="entry-icon"><Icon name="calendar"/></span><span class="entry-mini-card first">09:00 <b>Твои события</b><i/></span><span class="entry-mini-card second">Всё рядом <b>Твои записи</b><i/></span></div>
      <span class="section-caption">ТВОЁ ЛИЧНОЕ ПРОСТРАНСТВО</span><h1>{account.user ? 'С возвращением.' : 'Войти в свой ритм.'}</h1><p>{account.user ? 'Открываем твоё расписание и связанные записи.' : 'Одно расписание на телефоне и компьютере. Войди через Google — и все твои планы будут рядом.'}</p>
      {account.error && <div class="entry-error" role="alert">{account.error}</div>}
      {account.user ? <><button class="button primary" disabled={!account.error} onClick={onRetry}>{account.error ? 'Повторить подключение' : 'Загружаем расписание…'}</button>{account.error && <button class="text-button" onClick={onSignOut}>Выйти из аккаунта</button>}</> : <button class="google-signin" disabled={account.loading} onClick={onSignIn}><span aria-hidden="true">G</span>{account.loading ? 'Подключаем Google…' : 'Продолжить с Google'}<Icon name="arrow"/></button>}
      <small>Личные записи доступны только твоему аккаунту.</small><a class="entry-back" href="/" onClick={event => { if (onHome) { event.preventDefault(); onHome(); } }}>← Вернуться на главную</a>
    </main><footer>Поток · события, записи и время</footer></div>;
}
