import { useEffect, useRef, useState } from 'preact/hooks';
import { explainWorkspaceError, saveWithFreshData } from '../lib/workspace-provider.js';
import { loadData, persistData, emptyData } from '../lib/storage.js';

export function useWorkspace(editing, { initialMode, demoOnly = false, provider = null } = {}) {
  const cloudEnabled = Boolean(provider);
  const cached = demoOnly || !cloudEnabled ? null : provider.getSession?.();
  const explainError = error => provider?.explainError?.(error) || explainWorkspaceError(error);
  const [session, updateSession] = useState(() => {
    const mode = initialMode || (localStorage.getItem('tutor-schedule:mode') === 'personal' ? 'personal' : 'demo');
    if (cached?.user && cached.data && mode !== 'demo') return { mode: 'cloud', data: cached.data };
    return { mode, data: loadData(mode) };
  });
  const [account, setAccount] = useState(() => ({ user: cached?.user || null, loading: !cached?.resolved, authResolved: Boolean(cached?.resolved), hasData: Boolean(cached?.user && cached.data), error: '', ready: Boolean(cached?.user && cached.data && cached.fromServer), saving: false, online: navigator.onLine, lastSyncedAt:cached?.lastSyncedAt || null, syncing:false, syncError:'' }));
  const [stale, setStale] = useState(false);
  const latest = useRef({ session, account, editing });
  latest.current = { session, account, editing };
  function setSession(next) { latest.current.session = next; updateSession(next); }
  const client = useRef(null);
  const remote = useRef(null);
  const currentUserId = useRef(null);
  const dataOwner = useRef(cached?.user ? {provider,userId:cached.user.id} : null);
  const authEpoch = useRef(0);
  const renderEpoch=authEpoch.current;
  const saving = useRef(false);
  const syncing = useRef(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (demoOnly || !cloudEnabled) {
      client.current = null; remote.current = null;
      dataOwner.current = null;
      if (latest.current.session.mode === 'cloud') setSession({mode:'personal',data:loadData('personal')});
      setAccount(state => ({ ...state, user:null, loading:false, authResolved:true, hasData:false, ready:false, error:'' })); return;
    }
    let active = true, unsubscribeAuth, unsubscribeData;
    const fail = error => { if (active) setAccount(state => ({ ...state, loading: false, ready: false, hasData: error.code === 'permission-denied' ? false : state.hasData, error: explainError(error) })); };
    provider.connect().then(connection => {
      if (!active) return;
      client.current = connection;
      unsubscribeAuth = connection.onAuth(user => {
        if (!active) return;
        unsubscribeData?.(); remote.current = null; currentUserId.current = user?.id || null; authEpoch.current++;
        setStale(false);
        saving.current = false;syncing.current=null;
        setAccount(state => ({ ...state, user, loading: false, authResolved: true, hasData: false, ready: false, saving: false, error: '', lastSyncedAt:null, syncing:false, syncError:'' }));
        if (!user) {
          dataOwner.current=null;
          if (latest.current.session.mode === 'cloud') setSession({ mode: 'personal', data: loadData('personal') });
          return;
        }
        const sameOwner=dataOwner.current?.provider===provider && dataOwner.current.userId===user.id && latest.current.session.mode==='cloud';
        if (!sameOwner) {
          const retained=connection.getSession?.();
          setSession({mode:'cloud',data:retained?.user?.id===user.id && retained.data ? retained.data : {...emptyData(),records:[],revision:0}});
        }
        dataOwner.current={provider,userId:user.id};
        const epoch = authEpoch.current;
        unsubscribeData = connection.subscribe(user.id, (data, fromServer, syncedAt) => {
          if (!active || currentUserId.current !== user.id || authEpoch.current !== epoch) return;
          // Late cache events must not replace a newer server-confirmed revision.
          if (remote.current && data.revision < remote.current.revision) return;
          remote.current = data;
          setAccount(state => ({ ...state, hasData: true, ready: fromServer, error: '', ...(fromServer ? {lastSyncedAt:syncedAt ?? Date.now(),syncError:''} : syncedAt ? {lastSyncedAt:syncedAt} : {}) }));
          const current = latest.current;
          if (current.session.mode !== 'cloud') return;
          if (saving.current?.userId !== user.id && current.editing && data.revision !== (current.session.data.revision || 0)) setStale(true);
          else if (saving.current?.userId !== user.id) { setSession({ mode: 'cloud', data }); setStale(false); }
        }, error => { if (active && currentUserId.current===user.id && authEpoch.current===epoch) fail(error); });
      }, error => {
        if (!active) return;
        currentUserId.current = null; authEpoch.current++;
        dataOwner.current=null;
        if (latest.current.session.mode==='cloud') setSession({mode:'personal',data:loadData('personal')});
        setAccount(state => ({ ...state, user: null, hasData: false, authResolved: false, loading: false, ready: false, error: explainError(error) }));
      });
    }).catch(fail);
    return () => { active = false; unsubscribeAuth?.(); unsubscribeData?.(); currentUserId.current = null; authEpoch.current++; syncing.current=null; saving.current=false; client.current=null; };
  }, [retry, demoOnly, provider]);

  useEffect(() => {
    const changed = event => { if (event.key === `tutor-schedule:${latest.current.session.mode}:v2`) setStale(true); };
    const online = () => setAccount(state => ({ ...state, online:navigator.onLine }));
    window.addEventListener('storage', changed); window.addEventListener('online', online); window.addEventListener('offline', online);
    return () => { window.removeEventListener('storage', changed); window.removeEventListener('online', online); window.removeEventListener('offline', online); };
  }, []);

  function save(next) {
    const { session: current, account: auth } = latest.current;
    // The mutation was computed from this render, not whichever snapshot arrived
    // while an asynchronous editor/import action was finishing.
    if (current.mode!==session.mode || renderEpoch!==authEpoch.current) throw new Error('Аккаунт или режим изменился. Повтори действие в текущем расписании.');
    const expectedRevision=session.data.revision || 0;
    if (current.mode !== 'cloud') {
      const saved = persistData(current.mode,next,expectedRevision);
      setSession({ mode: current.mode, data: saved }); setStale(false);
      return saved;
    }
    if (!auth.ready || !auth.user || currentUserId.current !== auth.user.id) throw new Error('Дождись загрузки расписания из аккаунта.');
    if (!auth.online) throw new Error('Нет интернета. Редактор останется открытым: повтори сохранение после подключения.');
    if (saving.current) throw new Error('Предыдущее изменение ещё сохраняется.');
    const operation = { userId:auth.user.id, epoch:authEpoch.current };
    saving.current = operation;
    setAccount(state => ({ ...state, saving: true, error: '' }));
    const userId = auth.user.id;
    const isCurrent = () => currentUserId.current === userId && authEpoch.current === operation.epoch;
    return saveWithFreshData(client.current,userId,next,expectedRevision,{
      assertCurrent: () => { if (!isCurrent()) throw new Error('Аккаунт изменился. Открой расписание заново.'); },
      onFresh: data => {
        if (!remote.current || data.revision >= remote.current.revision) remote.current=data;
        setAccount(state=>({...state,lastSyncedAt:Date.now(),syncError:''}));
      },
    }).then(data => {
      if (!isCurrent()) throw new Error('Аккаунт изменился. Открой расписание заново.');
      // A newer snapshot may arrive while this transaction is acknowledged.
      const newest = remote.current?.revision > data.revision ? remote.current : data;
      remote.current = newest; setSession({ mode: 'cloud', data: newest }); setStale(false);
      setAccount(state=>({...state,lastSyncedAt:Date.now(),syncError:''}));
      return newest;
    }).catch(error => {
      if (isCurrent()) {
        setAccount(state => ({ ...state, error: explainError(error), ...(error.code==='permission-denied'?{ready:false,hasData:false}:{}) }));
        if (error.code === 'workspace/conflict' || remote.current?.revision !== current.data.revision) setStale(true);
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
    const {session}=latest.current;
    if (session.mode === 'cloud') {
      if (!remote.current) throw new Error('Нет связи с базой. Повтори после подключения.');
      setSession({ mode: 'cloud', data: remote.current });
    } else setSession({ mode: session.mode, data: loadData(session.mode) });
    setStale(false);
  }
  function sync() {
    const {session:current,account:auth}=latest.current;
    if(current.mode!=='cloud' || !auth.user || currentUserId.current!==auth.user.id || !client.current?.fetch) return Promise.reject(new Error('Сначала войди в аккаунт.'));
    if(!navigator.onLine) return Promise.reject(new Error('Нет интернета. Последняя сохранённая копия остаётся доступной.'));
    if(saving.current) return Promise.reject(new Error('Дождись сохранения изменений.'));
    if(syncing.current?.userId===auth.user.id) return syncing.current.promise;
    const operation={userId:auth.user.id,epoch:authEpoch.current};syncing.current=operation;
    setAccount(state=>({...state,syncing:true,syncError:''}));
    const connection=client.current;
    const assertCurrent=()=>{if(currentUserId.current!==operation.userId || authEpoch.current!==operation.epoch) throw new Error('Аккаунт изменился. Открой расписание заново.');};
    operation.promise=Promise.resolve().then(async()=>{assertCurrent();const data=await connection.fetch(operation.userId);assertCurrent();return data;}).catch(error=>{
      if(currentUserId.current===operation.userId && authEpoch.current===operation.epoch && syncing.current===operation) setAccount(state=>({...state,syncError:explainError(error),...(error.code==='permission-denied'?{ready:false,hasData:false,error:explainError(error)}:{})}));
      throw error;
    }).finally(()=>{if(syncing.current===operation){syncing.current=null;setAccount(state=>({...state,syncing:false}));}});
    return operation.promise;
  }
  useEffect(()=>{
    if(demoOnly) return;
    const automatic=()=>{
      const {session:current,account:auth}=latest.current;
      if(document.hidden || !navigator.onLine || current.mode!=='cloud' || !auth.user || !client.current?.fetch || saving.current || Date.now()-(auth.lastSyncedAt || 0)<30000) return;
      // Errors are retained in account.syncError and shown by the sync control.
      sync().catch(()=>{});
    };
    window.addEventListener('focus',automatic);window.addEventListener('online',automatic);document.addEventListener('visibilitychange',automatic);
    return()=>{window.removeEventListener('focus',automatic);window.removeEventListener('online',automatic);document.removeEventListener('visibilitychange',automatic);};
  },[demoOnly,provider]);
  function signIn() {
    if (!client.current || account.loading) return;
    setAccount(state => ({ ...state, loading: true, error: '' }));
    // Invoke directly in the click handler so mobile browsers allow the popup.
    const epoch=authEpoch.current;
    let result;
    try {result=client.current.signIn();}
    catch(error) {setAccount(state=>({...state,loading:false,error:explainError(error)}));return;}
    return Promise.resolve(result).catch(error=>{if(epoch===authEpoch.current) setAccount(state=>({...state,error:explainError(error)}));})
      .finally(()=>{if(epoch===authEpoch.current) setAccount(state=>({...state,loading:false}));});
  }
  async function signOut() {
    if (saving.current) throw new Error('Дождись сохранения изменений.');
    await client.current.signOut();
  }
  return { session, account, stale, save, switchMode, refresh, sync, signIn, signOut, reconnect: () => setRetry(value => value + 1) };
}
