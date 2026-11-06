# Подключить свой Firebase-адаптер

Firebase — необязательный пример интеграции. Для другого сервиса см. [контракт адаптера](ADAPTERS.md). Обычный `Site` открывает локальные данные; конфиг сам по себе больше не включает вход.

1. Создай собственный Firebase-проект и зарегистрируй Web-приложение.
2. Включи Authentication → Google, укажи поддержку и адрес разработки в Authorized domains. Для Tauri требуется отдельный системный OAuth, который пока не реализован.
3. Создай Cloud Firestore Standard в production mode, установи `examples/firebase/firestore.rules` и `firestore.indexes.json`.
4. Добавь Firebase SDK в зависимости своей сборки: `npm install firebase`. В исходниках самого ядра он установлен только для разработки/тестов адаптера.
5. Передай провайдер явно в своей точке входа:

```jsx
import { App } from '@potok/core';
import { createFirebaseProvider } from '@potok/core/adapters/firebase/index.js';

const provider = createFirebaseProvider({
  config: () => JSON.parse(import.meta.env.VITE_FIREBASE_CONFIG),
});
const screen = <App provider={provider} initialMode="personal"/>;
```

В исходниках этого репозитория путь импорта относительно `src/Site.jsx` — `./adapters/firebase/index.js`; компонент App импортируется из `./App.jsx`. Если обязательный вход нужен до показа расписания, добавь `requireAccount`.

Конфигурацию можно передать из игнорируемого `.env.local`:

```dotenv
VITE_FIREBASE_CONFIG={"apiKey":"YOUR_BROWSER_KEY","authDomain":"YOUR_PROJECT.firebaseapp.com","projectId":"YOUR_PROJECT","appId":"YOUR_APP_ID"}
```

Клиентские идентификаторы видны в собранном браузерном коде. Они не заменяют правила и проверку владельца; административные ключи не должны попадать в клиент. В адаптере остаются утилиты config.js и старый ключ potok:firebase-config: прежний конфиг не удаляется, но его использование теперь выбирает bootstrap сборки.

При нескольких проектах на одной странице передавай разные `appName`. Для существующей установки имя по умолчанию остаётся [DEFAULT], сохраняя пространство кеша входа. Перенос данных между облаками выполняется отдельно через экспорт/импорт JSON. Транзакционные записи требуют сети.
