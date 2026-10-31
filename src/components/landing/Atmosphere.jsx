import { Component, lazy, Suspense } from 'preact/compat';
import { useMotionVisibility } from '../../hooks/useMotionVisibility.js';
import { useTheme } from '../../theme/ThemeProvider.jsx';
const Threads = lazy(() => import('./Threads.jsx'));
class BackgroundBoundary extends Component {
  state = { failed:false };
  componentDidCatch(error) { console.warn('Decorative background unavailable:',error); this.setState({failed:true}); }
  render({children},{failed}) { return failed ? null : children; }
}
export function Atmosphere({ paused }) {
  const motion = useMotionVisibility();
  const {resolved} = useTheme();
  if (typeof WebGL2RenderingContext === 'undefined') return <div ref={motion.ref} class="home-atmosphere" aria-hidden="true"/>;
  return <div ref={motion.ref} class="home-atmosphere" aria-hidden="true"><BackgroundBoundary><Suspense fallback={null}><Threads color={resolved==='dark'?'#74988d':'#91b1a5'} lineCount={36} amplitude={1.4} distance={.38} angle={-16} parting={.35} speed={.32} opacity={.7} enableMouseInteraction paused={paused || !motion.active}/></Suspense></BackgroundBoundary></div>;
}
