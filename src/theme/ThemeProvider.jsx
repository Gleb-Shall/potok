import { createContext } from 'preact';
import { useContext, useLayoutEffect, useState } from 'preact/hooks';

export const THEME_KEY = 'potok:theme';
const valid = value => ['light', 'dark', 'system'].includes(value) ? value : 'system';
export function readTheme() {
  try { return valid(localStorage.getItem(THEME_KEY)); } catch { return 'system'; }
}
export function resolveTheme(theme) {
  return theme === 'system' ? (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : theme;
}
function applyTheme(theme) {
  const resolved = resolveTheme(theme);
  document.documentElement.classList.toggle('dark', resolved === 'dark');
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', resolved === 'dark' ? '#15131c' : '#faf9fe');
  return resolved;
}
const ThemeContext = createContext({ theme: 'system', resolved: 'light', setTheme: () => {} });
export function ThemeProvider({ children, forceLight = false }) {
  const [theme, updateTheme] = useState(readTheme);
  const [resolved, setResolved] = useState(() => forceLight ? 'light' : resolveTheme(readTheme()));
  const setTheme = value => {
    const next = valid(value);
    try { localStorage.setItem(THEME_KEY, next); } catch { /* Theme still works in memory when storage is unavailable. */ }
    updateTheme(next);
    setResolved(applyTheme(forceLight ? 'light' : next));
  };
  useLayoutEffect(() => {
    setResolved(applyTheme(forceLight ? 'light' : theme));
    const media = window.matchMedia?.('(prefers-color-scheme: dark)');
    const changed = () => { if (theme === 'system') setResolved(applyTheme(forceLight ? 'light' : 'system')); };
    const storage = event => { if (event.key === THEME_KEY || event.key === null) { const next = readTheme(); updateTheme(next); setResolved(applyTheme(forceLight ? 'light' : next)); } };
    media?.addEventListener('change', changed);
    window.addEventListener('storage', storage);
    return () => { media?.removeEventListener('change', changed); window.removeEventListener('storage', storage); };
  }, [theme, forceLight]);
  return <ThemeContext.Provider value={{ theme, resolved, setTheme }}>{children}</ThemeContext.Provider>;
}
export const useTheme = () => useContext(ThemeContext);
