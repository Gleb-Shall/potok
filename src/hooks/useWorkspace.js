import { useEffect, useRef, useState } from 'preact/hooks';
import { connectFirebase, explainFirebaseError } from '../lib/firebase-client.js';
import { loadData, persistData, emptyData } from '../lib/storage.js';

export function useWorkspace(editing, { initialMode, demoOnly = false } = {}) {
  const [session, updateSession] = useState(() => {
    const mode = initialMode || (localStorage.getItem('tutor-schedule:mode') === 'personal' ? 'personal' : 'demo');
    return { mode, data: loadData(mode) };
  });
  const [account, setAccount] = useState({ user: null, loading: true, error: '', ready: false, saving: false, online: navigator.onLine });
  const [stale, setStale] = useState(false);
  const latest = useRef({ session, account, editing });
  latest.current = { session, account, editing };
  function setSession(next) { latest.current.session = next; updateSession(next); }
  const client = useRef(null);
  const remote = useRef(null);
  const currentUid = useRef(null);
  const saving = useRef(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (demoOnly) { setAccount(state => ({ ...state, loading: false })); return; }
    let active = true, unsubscribeAuth, unsubscribeData;
    const fail = error => { if (active) setAccount(state => ({ ...state, loading: false, ready: false, error: explainFirebaseError(error) })); };
    connectFirebase().then(connection => {
      if (!active) return;
      client.current = connection;
      unsubscribeAuth = connection.onAuth(user => {
        if (!active) return;
        unsubscribeData?.(); remote.current = null; currentUid.current = user?.uid || null;
        setStale(false);
        saving.current = false;
        setAccount(state => ({ ...state, user, loading: false, ready: false, saving: false, error: '' }));
        if (!user) {
          if (latest.current.session.mode === 'cloud') setSession({ mode: 'personal', data: loadData('personal') });
          return;
        }
        setSession({ mode: 'cloud', data: { ...emptyData(), records: [], revision: 0 } });
        unsubscribeData = connection.subscribe(user.uid, (data, fromServer) => {
          if (!active || currentUid.current !== user.uid || !fromServer) return;
          remote.current = data;
          setAccount(state => ({ ...state, ready: true, error: '' }));
          const current = latest.current;
          if (current.session.mode !== 'cloud') return;
          if (saving.current?.uid !== user.uid && current.editing && data.revision !== (current.session.data.revision || 0)) setStale(true);
          else if (saving.current?.uid !== user.uid) { setSession({ mode: 'cloud', data }); setStale(false); }
        }, fail);
      }, fail);
    }).catch(fail);
    return () => { active = false; unsubscribeAuth?.(); unsubscribeData?.(); currentUid.current = null; };
  }, [retry, demoOnly]);

  useEffect(() => {
    const changed = event => { if (event.key === `tutor-schedule:${latest.current.session.mode}:v2`) setStale(true); };
    const online = () => setAccount(state => ({ ...state, online: navigator.onLine }));
    window.addEventListener('storage', changed); window.addEventListener('online', online); window.addEventListener('offline', online);
    return () => { window.removeEventListener('storage', changed); window.removeEventListener('online', online); window.removeEventListener('offline', online); };
  }, []);

  function save(next) {
    const { session: current, account: auth } = latest.current;
    if (current.mode !== 'cloud') {
      const saved = persistData(current.mode, next, current.data.revision || 0);
      setSession({ mode: current.mode, data: saved }); setStale(false);
      return saved;
    }
    if (!auth.ready || !auth.user || currentUid.current !== auth.user.uid) throw new Error('Дождись загрузки расписания из аккаунта.');
    if (!auth.online) throw new Error('Нет интернета. Редактор останется открытым: повтори сохранение после подключения.');
    if (saving.current) throw new Error('Предыдущее изменение ещё сохраняется.');
    const operation = { uid: auth.user.uid };
    saving.current = operation;
    setAccount(state => ({ ...state, saving: true, error: '' }));
    const uid = auth.user.uid;
    return client.current.save(uid, next, current.data.revision || 0).then(data => {
      if (currentUid.current !== uid) throw new Error('Аккаунт изменился. Открой расписание заново.');
      // A newer snapshot may arrive while this transaction is acknowledged.
      const newest = remote.current?.revision > data.revision ? remote.current : data;
      remote.current = newest; setSession({ mode: 'cloud', data: newest }); setStale(false);
      return newest;
    }).catch(error => {
      if (currentUid.current === uid) {
        setAccount(state => ({ ...state, error: explainFirebaseError(error) }));
        if (remote.current?.revision !== current.data.revision) setStale(true);
      }
      throw error;
    }).finally(() => { if (saving.current === operation) { saving.current = false; setAccount(state => ({ ...state, saving: false })); } });
  }
  function switchMode(mode) {
    if (saving.current) throw new Error('Дождись сохранения изменений.');
    const target = mode === 'personal' && account.user ? 'cloud' : mode;
    localStorage.setItem('tutor-schedule:mode', mode === 'demo' ? 'demo' : 'personal');
    setSession({ mode: target, data: target === 'cloud' ? remote.current || { ...emptyData(), records: [], revision: 0 } : loadData(target) });
    setStale(false);
  }
  function refresh() {
    if (session.mode === 'cloud') {
      if (!remote.current) throw new Error('Нет связи с базой. Повтори после подключения.');
      setSession({ mode: 'cloud', data: remote.current });
    } else setSession({ mode: session.mode, data: loadData(session.mode) });
    setStale(false);
  }
  function signIn() {
    if (!client.current || account.loading) return;
    setAccount(state => ({ ...state, loading: true, error: '' }));
    // Invoke directly in the click handler so mobile browsers allow the popup.
    client.current.signIn().catch(error => setAccount(state => ({ ...state, error: explainFirebaseError(error) })))
      .finally(() => setAccount(state => ({ ...state, loading: false })));
  }
  async function signOut() {
    if (saving.current) throw new Error('Дождись сохранения изменений.');
    await client.current.signOut();
  }
  return { session, account, stale, save, switchMode, refresh, signIn, signOut, reconnect: () => setRetry(value => value + 1) };
}
