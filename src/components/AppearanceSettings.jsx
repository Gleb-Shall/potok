import { useEffect, useState } from 'preact/hooks';
import { QUALITY_MODES, readAnimationQuality, setAnimationQuality, ANIMATION_QUALITY_KEY, APPEARANCE_CHANGE } from '../lib/appearance.js';

export function AppearanceSettings() {
  const [quality, setQuality] = useState(readAnimationQuality);
  useEffect(() => {
    const changed = event => setQuality(event.type === APPEARANCE_CHANGE ? event.detail : readAnimationQuality());
    const stored = event => { if (!event.key || event.key === ANIMATION_QUALITY_KEY) changed(event); };
    window.addEventListener(APPEARANCE_CHANGE, changed); window.addEventListener('storage', stored);
    return () => { window.removeEventListener(APPEARANCE_CHANGE, changed); window.removeEventListener('storage', stored); };
  }, []);
  return <section class="appearance-panel" data-ui><div class="appearance-intro"><h2>Качество анимаций</h2><p>Настрой чёткость анимаций и нагрузку под своё устройство. Изменения применяются сразу, в том числе к сценам на главной.</p></div><fieldset class="quality-options"><legend class="sr-only">Качество анимаций</legend>{QUALITY_MODES.map(mode => <label key={mode.id} class={quality === mode.id ? 'selected' : ''}><input type="radio" name="animation-quality" value={mode.id} checked={quality === mode.id} onChange={() => setQuality(setAnimationQuality(mode.id))}/><span><strong>{mode.name}</strong><small>{mode.description}</small></span>{mode.id === 'balanced' && <span class="quality-recommendation">По умолчанию</span>}</label>)}</fieldset><p class="appearance-note">Сохраняется на этом устройстве. На телефоне и компьютере можно выбрать разное качество.</p></section>;
}
