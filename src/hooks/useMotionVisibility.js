import { useEffect, useRef, useState } from 'preact/hooks';

export function useMotionVisibility() {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  const [reduced, setReduced] = useState(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || false);
  const [foreground, setForeground] = useState(() => !document.hidden);
  useEffect(() => {
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const motionChanged = () => setReduced(media.matches);
    const tabChanged = () => setForeground(!document.hidden);
    media?.addEventListener('change', motionChanged);
    document.addEventListener('visibilitychange', tabChanged);
    const observer = typeof IntersectionObserver === 'function' ? new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting)) : null;
    if (observer && ref.current) observer.observe(ref.current); else setVisible(true);
    return () => { observer?.disconnect(); media?.removeEventListener('change', motionChanged); document.removeEventListener('visibilitychange', tabChanged); };
  }, []);
  return { ref, active: visible && foreground && !reduced, reduced };
}
