import { useEffect, useState } from 'preact/hooks';
import { lazy, Suspense } from 'preact/compat';
import { ThemeProvider } from './theme/ThemeProvider.jsx';
import { Landing } from './components/Landing.jsx';
import { connectFirebase } from './lib/firebase-client.js';
const loadPlanner = () => import('./App.jsx').then(module => ({ default: module.App }));
const Planner = lazy(loadPlanner);

export function Site() { return <SiteRoutes/>; }

function SiteRoutes() {
  const [path, setPath] = useState(() => location.pathname);
  useEffect(() => { const back = () => setPath(location.pathname); window.addEventListener('popstate', back); return () => window.removeEventListener('popstate', back); }, []);
  const navigate = next => { if (location.pathname !== next) history.pushState({}, '', next); setPath(next); window.scrollTo(0, 0); };
  const page = path === '/demo' || path === '/app' || path.startsWith('/app/') ? 'personal' : 'landing';
  useEffect(() => {
    // Restore the saved session while the landing is visible, before the click.
    connectFirebase().catch(() => {}); // The workspace reports connection failures with a retry action.
    if (page === 'landing') loadPlanner().catch(() => {}); // Optional preload; navigation reports failures through AppBoundary.
  }, [page]);
  useEffect(() => { document.title = page === 'landing' ? 'Поток — события, записи и твой ритм' : 'Моё пространство — Поток'; }, [page]);
  useEffect(() => { if (path === '/demo') { history.replaceState({}, '', '/app'); setPath('/app'); } }, [path]);
  if (page === 'landing' && path !== '/demo') return <ThemeProvider forceLight><Landing navigate={navigate}/></ThemeProvider>;
  return <ThemeProvider><Suspense fallback={<div class="planner-loading"><span class="loading-orbit"/><p>Открываем твоё пространство…</p></div>}><Planner key={page} initialMode="personal" requireAccount onHome={() => navigate('/')} onPersonal={() => navigate('/app')}/></Suspense></ThemeProvider>;
}
