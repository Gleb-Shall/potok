import { createContext } from 'preact';
import { readAnimationQuality } from '../lib/appearance.js';
import { useContext, useLayoutEffect } from 'preact/hooks';

// Theme choice is paused while the interface is designed in light mode.
const light = Object.freeze({ theme: 'light', resolved: 'light' });
const ThemeContext = createContext(light);
export function ThemeProvider({ children }) {
  useLayoutEffect(() => {
    document.documentElement.classList.remove('dark');
    document.documentElement.dataset.animationQuality = readAnimationQuality();
    document.documentElement.style.colorScheme = 'light';
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#f4f4ef');
  }, []);
  return <ThemeContext.Provider value={light}>{children}</ThemeContext.Provider>;
}
export const useTheme = () => useContext(ThemeContext);
