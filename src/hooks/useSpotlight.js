// Pointer-gradient technique adapted from React Bits SpotlightCard.
// No animation loop or component re-render on pointer movement.
export function useSpotlight() {
  return event => {
    if (event.pointerType !== 'mouse' || !window.matchMedia?.('(hover: hover) and (pointer: fine)').matches || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const card = event.currentTarget;
    const bounds = card.getBoundingClientRect();
    card.style.setProperty('--spotlight-x', `${event.clientX - bounds.left}px`);
    card.style.setProperty('--spotlight-y', `${event.clientY - bounds.top}px`);
  };
}
