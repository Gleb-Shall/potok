export const COLOR_THEME_KEY = 'potok:color-theme';
export const COLOR_THEME_CHANGE = 'potok:color-theme-change';
export const COLOR_THEMES = Object.freeze([
  { id:'light', name:'Светлая', description:'Светлая бумага и цветные события.' },
  { id:'dark', name:'Тёмная', description:'Графитовый фон и мягкие акценты.' },
  { id:'system', name:'Как на устройстве', description:'Меняется вместе с системной темой.' },
]);
const valid = value => COLOR_THEMES.some(theme => theme.id === value) ? value : 'light';
let transientTheme;
export function readColorTheme() {
  if (transientTheme) return transientTheme;
  try { return valid(localStorage.getItem(COLOR_THEME_KEY)); } catch { return 'light'; }
}
export function setColorTheme(value) {
  const theme = valid(value);
  try { localStorage.setItem(COLOR_THEME_KEY, theme); transientTheme = undefined; }
  catch { transientTheme = theme; }
  window.dispatchEvent(new CustomEvent(COLOR_THEME_CHANGE, {detail:theme}));
  return theme;
}
export function resolveColorTheme(preference, systemDark) {
  return preference === 'dark' || preference === 'system' && systemDark ? 'dark' : 'light';
}
