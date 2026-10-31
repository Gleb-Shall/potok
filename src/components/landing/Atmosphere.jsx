import { Component, lazy, Suspense } from 'preact/compat';
import { useMotionVisibility } from '../../hooks/useMotionVisibility.js';
import { useTheme } from '../../theme/ThemeProvider.jsx';
const Threads = lazy(() => import('./Threads.jsx'));
class BackgroundBoundary extends Component {
  state = { failed:false };
  componentDidCatch(error) { console.warn('Decorative background unavailable:',error); this.setState({failed:true}); }
  render({children},{failed}) { return failed ? null : children; }
}
export function Atmosphere({ paused, variant = 'ribbons' }) {
  const motion = useMotionVisibility();
  const {resolved} = useTheme();
  if (typeof WebGL2RenderingContext === 'undefined') return <div ref={motion.ref} class="home-atmosphere" aria-hidden="true"/>;
  return <div ref={motion.ref} class="home-atmosphere" aria-hidden="true"><BackgroundBoundary><Suspense fallback={null}><Threads color={resolved==='dark'?'#74988d':'#91b1a5'} lineCount={variant==='contours'?48:28} amplitude={variant==='contours'?.7:1.8} distance={variant==='contours'?.14:.38} angle={variant==='contours'?-65:-16} parting={.45} speed={.23} opacity={.65} enableMouseInteraction paused={paused || !motion.active}/></Suspense></BackgroundBoundary></div>;
}
