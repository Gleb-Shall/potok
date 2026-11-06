import { Brand } from './Brand.jsx';
import { Icon } from './Icon.jsx';

export function WorkspaceEntry({ provider, account, onSignIn, onRetry, onSignOut, onHome }) {
  return <div class="workspace-entry"><header><Brand onClick={event => { if (onHome) { event.preventDefault(); onHome(); } }}/></header>
    <main><div class="entry-illustration" aria-hidden="true"><span class="entry-orbit"/><span class="entry-orbit second"/><span class="entry-icon"><Icon name="calendar"/></span><span class="entry-mini-card first">09:00 <b>Твои события</b><i/></span><span class="entry-mini-card second">Всё рядом <b>Твои записи</b><i/></span></div>
      <span class="section-caption">ТВОЁ ЛИЧНОЕ ПРОСТРАНСТВО</span><h1>{account.user ? 'С возвращением.' : 'Войти в свой ритм.'}</h1><p>{account.user ? 'Открываем твоё расписание и связанные записи.' : 'Войди в свой аккаунт, чтобы открыть расписание на разных устройствах.'}</p>
      {account.error && <div class="entry-error" role="alert">{account.error}</div>}
      {account.user ? <><button class="button primary" disabled={!account.error} onClick={onRetry}>{account.error ? 'Повторить подключение' : 'Загружаем расписание…'}</button>{account.error && <button class="text-button" onClick={onSignOut}>Выйти из аккаунта</button>}</> : <button class="account-signin" disabled={account.loading || !provider} onClick={onSignIn}><Icon name="login"/>{account.loading ? 'Подключение…' : provider?.entryLabel || 'Войти'}<Icon name="arrow"/></button>}
      <small>Личные записи доступны только твоему аккаунту.</small><a class="entry-back" href="/" onClick={event => { if (onHome) { event.preventDefault(); onHome(); } }}>← Вернуться на главную</a>
    </main><footer>Поток · события, записи и время</footer></div>;
}
