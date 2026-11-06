import { ExternalLink } from './LinkedValue.jsx';

export function CloudSettings({ provider, signedIn }) {
  const Settings=provider?.Settings;
  if (Settings) return <Settings signedIn={signedIn}/>;
  if (provider) return null;
  return <article class="settings-card cloud-settings"><h2>Синхронизация</h2>
    <p>Данные хранятся на этом устройстве. Для своей авторизации и хранилища можно подключить адаптер сервиса.</p>
    <ExternalLink href="https://github.com/Gleb-Shall/potok/blob/main/docs/architecture/sync/ADAPTERS.md">Как подключить свой сервис</ExternalLink>
  </article>;
}
