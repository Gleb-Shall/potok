const COLLECTIONS = ['students', 'series', 'lessons'];
const clone = value => structuredClone(value);

function checkData(data) {
  if (!data || COLLECTIONS.some(name => !Array.isArray(data[name]) || data[name].some(record => !record || typeof record.id !== 'string'))) {
    throw new Error('Неизвестный формат сохранённых данных. Исходные данные не изменены.');
  }
  return clone(data);
}

export function createLocalStore(storage, key, initial) {
  let stored;
  try { stored = storage.getItem(key); }
  catch { throw new Error('Не удалось прочитать данные. Разреши хранение данных сайта в настройках браузера.'); }
  let parsed;
  try { parsed = stored === null ? initial : JSON.parse(stored); }
  catch { throw new Error('Не удалось прочитать сохранённое расписание. Исходные данные не изменены.'); }
  let data = checkData(parsed);
  function replace(next) {
    const valid = checkData(next);
    try { storage.setItem(key, JSON.stringify(valid)); }
    catch { throw new Error('Не удалось сохранить изменения. Проверь доступное место и настройки хранения в браузере.'); }
    data = valid;
    return clone(data);
  }
  return {
    getState: () => clone(data),
    replace,
    upsert(name, record) {
      if (!COLLECTIONS.includes(name) || !record || typeof record.id !== 'string' || !record.id) throw new Error('Некорректная запись.');
      const records = data[name].filter(item => item.id !== record.id);
      return replace({ ...data, [name]: [...records, clone(record)] });
    }
  };
}
