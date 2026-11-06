import { readAnimationQuality } from '../lib/appearance.js';
import { useLayoutEffect } from 'preact/hooks';
import { readColorTheme, resolveColorTheme, COLOR_THEME_KEY, COLOR_THEME_CHANGE } from '../lib/color-theme.js';

function applyTheme(theme) {
  const root = document.documentElement;
  root.classList.remove('dark'); // Retired legacy rules must not mix with the new palette.
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#191c19' : '#ffffff');
}

// App owns the theme lifetime, including its sign-in screen and portalled dialogs.
// Returning from App to the hosted landing restores light mode without changing the preference.
export function useWorkspaceTheme() {
  useLayoutEffect(() => {
    const root = document.documentElement;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    root.dataset.themeScope = 'workspace';
    const update = () => applyTheme(resolveColorTheme(readColorTheme(), media.matches));
    const stored = event => { if (!event.key || event.key === COLOR_THEME_KEY) update(); };
    update();
    window.addEventListener(COLOR_THEME_CHANGE, update);
    window.addEventListener('storage', stored);
    media.addEventListener('change', update);
    return () => {
      window.removeEventListener(COLOR_THEME_CHANGE, update);
      window.removeEventListener('storage', stored);
      media.removeEventListener('change', update);
      delete root.dataset.themeScope;
      applyTheme('light');
    };
  }, []);
}

export function ThemeProvider({ children }) {
  useLayoutEffect(() => {
    document.documentElement.dataset.animationQuality = readAnimationQuality();
    if (document.documentElement.dataset.themeScope !== 'workspace') applyTheme('light');
  }, []);
  return children;
}
