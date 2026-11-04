const MODES = Object.freeze({ economy: { pixels:1_000_000, ratio:1, texture:1.25 }, balanced: { pixels:3_000_000, ratio:2, texture:2 }, high: { pixels:6_000_000, ratio:3, texture:2.5 } });
const mode = quality => MODES[quality] || MODES.balanced;
// Retina detail where it is visible, with a bounded full-screen GPU surface.
export function renderPixelRatio(width, height, deviceRatio = 1, quality = 'balanced') {
  const setting = mode(quality);
  return Math.min(deviceRatio, setting.ratio, Math.sqrt(setting.pixels / Math.max(1, width * height)));
}
export const texturePixelRatio = (deviceRatio = 1, quality = 'balanced') => Math.min(deviceRatio, mode(quality).texture);
