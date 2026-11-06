import { render } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { AppearanceSettings } from '../src/components/AppearanceSettings.jsx';
import { readAnimationQuality, ANIMATION_QUALITY_KEY } from '../src/lib/appearance.js';
import { useState } from 'preact/hooks';
import { ThemeProvider, useWorkspaceTheme } from '../src/theme/ThemeProvider.jsx';
import { COLOR_THEME_KEY, readColorTheme } from '../src/lib/color-theme.js';
let root;
beforeEach(() => { localStorage.clear(); root=document.createElement('div'); document.body.append(root); });
afterEach(async () => { await act(() => render(null,root)); root.remove(); vi.restoreAllMocks(); delete document.documentElement.dataset.animationQuality; });
it('persists the chosen quality and restores it when settings are reopened', async () => {
  await act(() => render(<AppearanceSettings/>,root));
  expect(root.querySelector('input[name="animation-quality"]:checked').value).toBe('balanced');
  await act(() => root.querySelector('input[value="high"]').click());
  expect(readAnimationQuality()).toBe('high');
  expect(document.documentElement.dataset.animationQuality).toBe('high');
  await act(() => render(null,root));
  await act(() => render(<AppearanceSettings/>,root));
  expect(root.querySelector('input[name="animation-quality"]:checked').value).toBe('high');
  localStorage.setItem(ANIMATION_QUALITY_KEY,'economy');
  await act(() => window.dispatchEvent(new StorageEvent('storage',{key:ANIMATION_QUALITY_KEY,newValue:'economy'})));
  expect(root.querySelector('input[name="animation-quality"]:checked').value).toBe('economy');
});

function Workspace({children}) { useWorkspaceTheme(); return <>{children}<AppearanceSettings/></>; }
it('persists dark mode, restores it when reopened and resets the document when leaving the workspace', async () => {
  await act(() => render(<ThemeProvider><Workspace/></ThemeProvider>, root));
  expect(document.documentElement.dataset.theme).toBe('light');
  await act(() => root.querySelector('input[name="color-theme"][value="dark"]').click());
  expect(readColorTheme()).toBe('dark');
  expect(document.documentElement.dataset.theme).toBe('dark');
  expect(document.documentElement.style.colorScheme).toBe('dark');
  expect(document.documentElement.classList.contains('dark')).toBe(false);
  await act(() => render(null, root));
  expect(document.documentElement.dataset.theme).toBe('light');
  await act(() => render(<ThemeProvider><Workspace/></ThemeProvider>, root));
  expect(document.documentElement.dataset.theme).toBe('dark');
  expect(root.querySelector('input[name="color-theme"]:checked').value).toBe('dark');
  localStorage.setItem(COLOR_THEME_KEY,'light');
  await act(() => window.dispatchEvent(new StorageEvent('storage',{key:COLOR_THEME_KEY,newValue:'light'})));
  expect(document.documentElement.dataset.theme).toBe('light');
  expect(root.querySelector('input[name="color-theme"]:checked').value).toBe('light');
});

it('tracks system changes only when selected and removes the media listener on unmount', async () => {
  const listeners=new Set();
  const media={matches:true,addEventListener:vi.fn((_,callback)=>listeners.add(callback)),removeEventListener:vi.fn((_,callback)=>listeners.delete(callback))};
  vi.spyOn(window,'matchMedia').mockReturnValue(media);
  await act(() => render(<Workspace/>, root));
  expect(document.documentElement.dataset.theme).toBe('light'); // No surprise dark mode from the OS.
  await act(() => root.querySelector('input[name="color-theme"][value="system"]').click());
  expect(document.documentElement.dataset.theme).toBe('dark');
  await act(() => {media.matches=false;listeners.forEach(callback=>callback());});
  expect(document.documentElement.dataset.theme).toBe('light');
  await act(() => root.querySelector('input[name="color-theme"][value="dark"]').click());
  await act(() => listeners.forEach(callback=>callback()));
  expect(document.documentElement.dataset.theme).toBe('dark');
  await act(() => render(null, root));
  expect(listeners.size).toBe(0);
});

it('keeps the landing light and restores the saved theme on reentering the app', async () => {
  localStorage.setItem(COLOR_THEME_KEY,'dark');
  function Site() {
    const [app,setApp]=useState(true);
    return <ThemeProvider>{app ? <Workspace><button onClick={()=>setApp(false)}>Главная</button></Workspace> : <button onClick={()=>setApp(true)}>Календарь</button>}</ThemeProvider>;
  }
  await act(() => render(<Site/>, root));
  expect(document.documentElement.dataset.theme).toBe('dark');
  await act(() => [...root.querySelectorAll('button')].find(node=>node.textContent==='Главная').click());
  expect(document.documentElement.dataset.theme).toBe('light');
  expect(readColorTheme()).toBe('dark');
  await act(() => root.querySelector('button').click());
  expect(document.documentElement.dataset.theme).toBe('dark');
});
