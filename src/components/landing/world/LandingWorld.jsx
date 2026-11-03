import { useEffect, useRef } from 'preact/hooks';

export function LandingWorld({ root, paused, event, data }) {
  const canvas = useRef(null);
  const controller = useRef(null);
  const latest = useRef({ paused, event, data });
  latest.current = { paused, event, data };
  useEffect(() => {
    let disposed = false;
    const element = root.current;
    if (!element || typeof WebGL2RenderingContext === 'undefined') {
      if (element) element.dataset.world = 'fallback';
      return;
    }
    import('./world-engine.js').then(({ createWorld }) => {
      if (disposed) return;
      controller.current = createWorld(canvas.current, element, () => latest.current);
    }).catch(error => {
      console.warn('Potok spatial scene unavailable:', error);
      element.dataset.world = 'fallback';
    });
    return () => {
      disposed = true;
      controller.current?.dispose();
      controller.current = null;
    };
  }, [root]);
  useEffect(() => { controller.current?.invalidate(); }, [paused, event, data]);
  return <canvas class="flow-world" ref={canvas} aria-hidden="true"/>;
}
