import { normalizeData, defaultTypes } from './events.js';
import { createDemo } from './legacy-demo.js';
import { todayISO, mondayOf, addDays } from './domain.js';

export function demoData() {
  const data = normalizeData(createDemo(todayISO()));
  const monday = mondayOf(todayISO());
  data.series.push({ id: 'demo-class', typeId: 'class', title: 'Математический анализ', studentId: '', color: 'blue', busy: true, from: monday, until: '', weekday: 1, start: 540, duration: 90, intervalWeeks: 1, fields: { teacher: 'Преподаватель', room: 'Ауд. 204', format: 'Лекция' }, notes: '' });
  data.events.push({ id: 'demo-personal', typeId: 'personal', title: 'Время для себя', studentId: '', color: 'green', busy: false, date: addDays(monday, 4), anchorDate: addDays(monday, 4), start: 1200, duration: 60, seriesId: '', status: 'planned', history: [], fields: { location: 'Прогулка' }, notes: '' });
  return data;
}
export const emptyData = () => ({ version: 2, students: [], types: defaultTypes(), series: [], events: [] });
export function loadData(mode) {
  const key = `tutor-schedule:${mode}:v2`;
  const raw = localStorage.getItem(key);
  if (raw) return normalizeData(JSON.parse(raw));
  const old = localStorage.getItem(`tutor-schedule:${mode}:v1`);
  if (old) {
    const migrated = normalizeData(JSON.parse(old));
    // Keep the previous key intact as a recovery copy until migration is accepted.
    localStorage.setItem(key, JSON.stringify(migrated));
    return migrated;
  }
  return mode === 'demo' ? demoData() : emptyData();
}
export function persistData(mode, data, revision = 0) {
  const key = `tutor-schedule:${mode}:v2`;
  const current = localStorage.getItem(key);
  if (current && (JSON.parse(current).revision || 0) !== revision) throw new Error('Расписание изменилось в другой вкладке. Обнови данные перед сохранением.');
  const next = { ...data, revision: revision + 1 };
  try { localStorage.setItem(key, JSON.stringify(next)); }
  catch { throw new Error('Не удалось сохранить изменения. Проверь свободное место и разрешение на хранение данных в браузере.'); }
  return next;
}
export function exportData(mode, data) {
  const blob = new Blob([JSON.stringify({ version: 2, exportedAt: new Date().toISOString(), mode, data }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = `potok-${mode}-${todayISO()}.json`; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
