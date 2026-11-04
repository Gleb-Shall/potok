import { useEffect } from 'preact/hooks';

// Native scrolling and one-shot compositor animations, never an idle frame loop.
export function useMobileLandingMotion(root, paused) {
  useEffect(() => {
    const node = root.current;
    const media = window.matchMedia?.('(max-width: 759px) and (prefers-reduced-motion: no-preference)');
    if (!node || !media || typeof IntersectionObserver !== 'function') return;
    const animations = new Map(), seen = new WeakSet();
    let observer;
    const stop = () => {
      observer?.disconnect();
      animations.forEach(animation => animation.cancel()); animations.clear();
    };
    const setup = () => {
      stop();
      if (!media.matches || paused) return;
      observer = new IntersectionObserver(entries => {
        for (const entry of entries) {
          if (!entry.isIntersecting || document.hidden) continue;
          const target = entry.target; observer.unobserve(target);
          if (seen.has(target) || !target.animate) continue;
          seen.add(target);
          const animation = target.animate([
            { transform:'perspective(800px) translateY(40px) rotateX(9deg)', opacity:.65 },
            { transform:'perspective(800px) translateY(0) rotateX(0)', opacity:1 },
          ], { duration:650, easing:'cubic-bezier(.22,1,.36,1)' });
          animations.set(target, animation);
          animation.onfinish = () => animations.delete(target);
        }
      }, { threshold:.15 });
      node.querySelectorAll('.studio-live-card,.network-source,.network-event').forEach(target => observer.observe(target));
    };
    const cancelWhenEditing = event => {
      for (const [target, animation] of animations) {
        if (target.contains(event.target)) { animation.cancel(); animations.delete(target); }
      }
    };
    const visibility = () => {
      if (document.hidden) { animations.forEach(animation => animation.finish()); animations.clear(); }
    };
    setup(); media.addEventListener('change', setup);
    node.addEventListener('pointerdown', cancelWhenEditing, { passive:true });
    document.addEventListener('visibilitychange', visibility);
    return () => { stop(); media.removeEventListener('change', setup); node.removeEventListener('pointerdown', cancelWhenEditing); document.removeEventListener('visibilitychange', visibility); };
  }, [root, paused]);
}
