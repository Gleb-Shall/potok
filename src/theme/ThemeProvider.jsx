import { readAnimationQuality } from '../lib/appearance.js';
import { useLayoutEffect } from 'preact/hooks';

// Theme choice is paused while the interface is designed in light mode.
export function ThemeProvider({ children }) {
  useLayoutEffect(() => {
    document.documentElement.classList.remove('dark');
    document.documentElement.dataset.animationQuality = readAnimationQuality();
    document.documentElement.style.colorScheme = 'light';
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#f4f4ef');
  }, []);
  return children;
}
