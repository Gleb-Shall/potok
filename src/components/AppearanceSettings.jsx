import { useEffect, useState } from 'preact/hooks';
import { QUALITY_MODES, readAnimationQuality, setAnimationQuality, ANIMATION_QUALITY_KEY, APPEARANCE_CHANGE } from '../lib/appearance.js';
import { COLOR_THEMES, COLOR_THEME_KEY, COLOR_THEME_CHANGE, readColorTheme, setColorTheme } from '../lib/color-theme.js';

export function AppearanceSettings() {
  const [theme, setTheme] = useState(readColorTheme);
  const [quality, setQuality] = useState(readAnimationQuality);
  useEffect(() => {
    const changed = () => setTheme(readColorTheme());
    const stored = event => { if (!event.key || event.key === COLOR_THEME_KEY) changed(); };
    window.addEventListener(COLOR_THEME_CHANGE, changed); window.addEventListener('storage', stored);
    return () => { window.removeEventListener(COLOR_THEME_CHANGE, changed); window.removeEventListener('storage', stored); };
  }, []);
  useEffect(() => {
    const changed = event => setQuality(event.type === APPEARANCE_CHANGE ? event.detail : readAnimationQuality());
    const stored = event => { if (!event.key || event.key === ANIMATION_QUALITY_KEY) changed(event); };
    window.addEventListener(APPEARANCE_CHANGE, changed); window.addEventListener('storage', stored);
    return () => { window.removeEventListener(APPEARANCE_CHANGE, changed); window.removeEventListener('storage', stored); };
  }, []);
  return <section class="appearance-panel" data-ui>
    <div class="appearance-intro"><h2>Тема оформления</h2></div>
    <fieldset class="color-theme-options"><legend class="sr-only">Тема оформления</legend>{COLOR_THEMES.map(option => <label key={option.id} class={theme === option.id ? 'selected' : ''}>
      <span class={`theme-preview theme-preview-${option.id}`} aria-hidden="true"><i/><i/><i/></span>
      <span class="theme-option-copy"><strong>{option.name}</strong></span>
      <input type="radio" name="color-theme" value={option.id} checked={theme === option.id} onChange={() => setTheme(setColorTheme(option.id))}/>
    </label>)}</fieldset>
    <div class="appearance-intro"><h2>Качество анимаций</h2></div><fieldset class="quality-options"><legend class="sr-only">Качество анимаций</legend>{QUALITY_MODES.map(mode => <label key={mode.id} class={quality === mode.id ? 'selected' : ''}><input type="radio" name="animation-quality" value={mode.id} checked={quality === mode.id} onChange={() => setQuality(setAnimationQuality(mode.id))}/><span><strong>{mode.name}</strong><small>{mode.description}</small></span></label>)}</fieldset><p class="appearance-note">Сохраняется на этом устройстве. На телефоне и компьютере можно выбрать разное качество.</p></section>;
}
