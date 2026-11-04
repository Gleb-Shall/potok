export const ANIMATION_QUALITY_KEY = 'potok:animation-quality';
export const APPEARANCE_CHANGE = 'potok:appearance-change';
export const QUALITY_MODES = Object.freeze([
  { id:'economy', name:'Экономное', description:'Меньше нагрузка и проще детали. Для слабых устройств и работы от батареи.' },
  { id:'balanced', name:'Сбалансированное', description:'Чёткие детали и умеренная нагрузка. Подходит для большинства устройств.' },
  { id:'high', name:'Высокое', description:'Больше деталей на экранах с высоким разрешением. Выше нагрузка на устройство.' },
]);
const valid = value => QUALITY_MODES.some(mode => mode.id === value) ? value : 'balanced';
let transientQuality;
export function readAnimationQuality() {
  if (transientQuality) return transientQuality;
  try { return valid(localStorage.getItem(ANIMATION_QUALITY_KEY)); } catch { return 'balanced'; }
}
export function setAnimationQuality(value) {
  const quality = valid(value);
  try { localStorage.setItem(ANIMATION_QUALITY_KEY, quality); transientQuality = undefined; } catch { transientQuality = quality; }
  document.documentElement.dataset.animationQuality = quality;
  window.dispatchEvent(new CustomEvent(APPEARANCE_CHANGE, { detail:quality }));
  return quality;
}
