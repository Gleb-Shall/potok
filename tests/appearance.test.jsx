import { render } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { AppearanceSettings } from '../src/components/AppearanceSettings.jsx';
import { readAnimationQuality, ANIMATION_QUALITY_KEY } from '../src/lib/appearance.js';
import { renderPixelRatio, texturePixelRatio } from '../src/components/landing/world/render-quality.js';
let root;
beforeEach(() => { localStorage.clear(); root=document.createElement('div'); document.body.append(root); });
afterEach(async () => { await act(() => render(null,root)); root.remove(); vi.restoreAllMocks(); delete document.documentElement.dataset.animationQuality; });
it('persists the chosen quality and restores it when settings are reopened', async () => {
  await act(() => render(<AppearanceSettings/>,root));
  expect(root.querySelector('input:checked').value).toBe('balanced');
  await act(() => root.querySelector('input[value="high"]').click());
  expect(readAnimationQuality()).toBe('high');
  expect(document.documentElement.dataset.animationQuality).toBe('high');
  await act(() => render(null,root));
  await act(() => render(<AppearanceSettings/>,root));
  expect(root.querySelector('input:checked').value).toBe('high');
  localStorage.setItem(ANIMATION_QUALITY_KEY,'economy');
  await act(() => window.dispatchEvent(new StorageEvent('storage',{key:ANIMATION_QUALITY_KEY,newValue:'economy'})));
  expect(root.querySelector('input:checked').value).toBe('economy');
});
it('raises phone detail in higher modes while bounding the GPU pixel count', () => {
  expect(renderPixelRatio(390,844,3,'economy')).toBe(1);
  expect(renderPixelRatio(390,844,3,'balanced')).toBe(2);
  expect(renderPixelRatio(390,844,3,'high')).toBe(3);
  for (const [mode,budget] of [['economy',1_000_000],['balanced',3_000_000],['high',6_000_000]]) {
    for (const [width,height] of [[1920,1080],[3840,2160]]) {
      const ratio=renderPixelRatio(width,height,3,mode);
      expect(width*height*ratio*ratio).toBeLessThanOrEqual(budget+1);
    }
  }
  expect(texturePixelRatio(3,'high')).toBeGreaterThan(texturePixelRatio(3,'economy'));
});
