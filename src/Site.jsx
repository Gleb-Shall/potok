import { useEffect, useState } from 'preact/hooks';
import { lazy, Suspense } from 'preact/compat';
import { ThemeProvider } from './theme/ThemeProvider.jsx';
import { Landing } from './components/Landing.jsx';
const Planner = lazy(() => import('./App.jsx').then(module => ({ default: module.App })));

export function Site() { return <ThemeProvider><SiteRoutes/></ThemeProvider>; }

function SiteRoutes() {
  const [path, setPath] = useState(() => location.pathname);
  useEffect(() => { const back = () => setPath(location.pathname); window.addEventListener('popstate', back); return () => window.removeEventListener('popstate', back); }, []);
  const navigate = next => { if (location.pathname !== next) history.pushState({}, '', next); setPath(next); window.scrollTo(0, 0); };
  const page = path === '/demo' ? 'demo' : path === '/app' || path.startsWith('/app/') ? 'personal' : 'landing';
  useEffect(() => { document.title = page === 'landing' ? 'Поток — события, записи и твой ритм' : page === 'demo' ? 'Демо — Поток' : 'Моё пространство — Поток'; }, [page]);
  if (page === 'landing') return <Landing navigate={navigate}/>;
  return <Suspense fallback={<div class="planner-loading"><span class="loading-orbit"/><p>Открываем твоё пространство…</p></div>}><Planner key={page} initialMode={page} demoOnly={page === 'demo'} requireAccount={page === 'personal'} onHome={() => navigate('/')} onPersonal={() => navigate('/app')} onDemo={() => navigate('/demo')}/></Suspense>;
}
