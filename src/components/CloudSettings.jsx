import { useState } from 'preact/hooks';
import { getFirebaseConfig, hasManagedCloud, saveFirebaseConfig, clearFirebaseConfig } from '../lib/cloud-config.js';
import { Button } from './UI.jsx';

export function CloudSettings({ signedIn }) {
  const [value, setValue] = useState(() => JSON.stringify(getFirebaseConfig() || {}, null, 2));
  const [error, setError] = useState('');
  if (hasManagedCloud()) return null;
  const configured = Boolean(getFirebaseConfig());
  return <article class="settings-card cloud-settings">
    <h2>Своё облако</h2>
    <p>Без подключения планы сохраняются на этом устройстве. Для синхронизации подключи собственный проект Firebase.</p>
    <details open={!configured}><summary>{configured ? 'Настройки подключения' : 'Подключить Firebase'}</summary>
      <p>Включи Google-вход и Firestore в своём проекте, установи правила из инструкции и вставь JSON-объект firebaseConfig. Серверные ключи сюда не нужны.</p>
      <label class="field"><span>Конфигурация Firebase</span><textarea rows="9" spellCheck={false} value={value} onInput={event=>setValue(event.currentTarget.value)} disabled={signedIn}/></label>
      {error && <p role="alert">{error}</p>}
      {signedIn ? <p>Для смены проекта сначала выйди из аккаунта.</p> : <div class="settings-actions">
        <Button onClick={()=>{try {saveFirebaseConfig(value);location.reload();} catch (error) {setError(error.message);}}}>Сохранить подключение</Button>
        {configured && <Button onClick={()=>{try {clearFirebaseConfig();location.reload();} catch(error) {setError(error.message);}}}>Отключить облако</Button>}
      </div>}
    </details>
  </article>;
}
