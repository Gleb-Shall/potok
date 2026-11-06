const KEY = 'potok:firebase-config';
const fields = ['apiKey', 'authDomain', 'projectId', 'appId', 'storageBucket', 'messagingSenderId'];

export function validateFirebaseConfig(value) {
  const config = typeof value === 'string' ? JSON.parse(value) : value;
  if (!config || typeof config !== 'object' || Array.isArray(config)) throw new Error('Нужен объект firebaseConfig из настроек Firebase.');
  for (const key of ['apiKey', 'authDomain', 'projectId', 'appId']) {
    if (typeof config[key] !== 'string' || !config[key].trim()) throw new Error(`Не заполнено поле ${key}.`);
  }
  if (!/^[a-zA-Z0-9.-]+$/.test(config.authDomain)) throw new Error('authDomain должен содержать имя домена без https:// и пути.');
  return Object.fromEntries(fields.filter(key => typeof config[key] === 'string' && config[key].trim()).map(key => [key, config[key].trim()]));
}
export const hasManagedCloud = () => Boolean(import.meta.env?.VITE_FIREBASE_CONFIG?.trim());
export function getFirebaseConfig() {
  const managed = import.meta.env?.VITE_FIREBASE_CONFIG;
  if (managed?.trim()) return validateFirebaseConfig(managed);
  const raw = globalThis.localStorage?.getItem(KEY);
  return raw ? validateFirebaseConfig(raw) : null;
}
export function saveFirebaseConfig(value) {
  if (hasManagedCloud()) throw new Error('Подключение этой сборки управляется владельцем сайта.');
  const config = validateFirebaseConfig(value);
  localStorage.setItem(KEY, JSON.stringify(config));
  return config;
}
export function clearFirebaseConfig() {
  if (hasManagedCloud()) throw new Error('Подключение этой сборки управляется владельцем сайта.');
  localStorage.removeItem(KEY);
}
