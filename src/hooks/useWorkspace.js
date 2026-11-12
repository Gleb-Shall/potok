import { useEffect, useRef, useState } from 'preact/hooks';
import { explainWorkspaceError } from '../lib/workspace-provider.js';
import { loadData, persistData } from '../lib/storage.js';
import { normalizeData } from '../lib/events.js';
import { checkpointWorkspace, planWorkspaceSync, readWorkspaceCache, sameWorkspace, updateWorkspaceCache, visibleWorkspace, workspaceCacheKey } from '../lib/offline-workspace.js';

const WORKSPACE_LOAD_TIMEOUT = 10000;
const sessionChanged = () => new Error('Аккаунт изменился. Открой расписание заново.');

function readCloud(connection, userId) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('Облако не ответило. Изменения остаются на устройстве.')), WORKSPACE_LOAD_TIMEOUT);
  });
  return Promise.race([Promise.resolve().then(() => connection.fetch(userId)), timeout]).finally(() => clearTimeout(timer));
}

export function useWorkspace(editing, { initialMode, demoOnly = false, provider = null } = {}) {
  const cloudEnabled = Boolean(provider && !demoOnly);
  const cached = cloudEnabled ? provider.getSession?.() : null;
  const explainError = error => provider?.explainError?.(error) || explainWorkspaceError(error);
  const [session, updateSession] = useState(() => {
    const mode = initialMode || (localStorage.getItem('tutor-schedule:mode') === 'personal' ? 'personal' : 'demo');
    return { mode, data: loadData(mode) };
  });
  const [account, setAccount] = useState(() => ({
    user: null, loading: cloudEnabled, authResolved: !cloudEnabled, hasData: false, error: '',
    ready: false, saving: false, online: navigator.onLine, lastSyncedAt: cached?.lastSyncedAt || null,
    syncing: false, syncError: '', pending: false, conflict: null,
  }));
  const [stale, setStale] = useState(false);
  const [retry, setRetry] = useState(0);
  const latest = useRef({ session, account, editing });
  latest.current = { session, account, editing };
  const client = useRef(null);
  const owner = useRef(null);
  const saving = useRef(null);
  const syncing = useRef(null);
  const renderedOwner = owner.current;
  const displayedOwner = useRef(null);

  function setSession(next) {
    latest.current.session = next;
    updateSession(next);
  }

  function showEntry(entry, identity, force = false) {
    if (!entry || owner.current !== identity) return;
    setAccount(state => ({ ...state, hasData: true, pending: Boolean(entry.draft),
      conflict: entry.draft && state.conflict?.version === entry.version ? state.conflict : null,
    }));
    const current = latest.current;
    if (!force && displayedOwner.current?.key === identity.key) {
      if (current.session.mode !== 'cloud' || current.session.data.revision === entry.version) return;
      if (current.editing) { setStale(true); return; }
    }
    displayedOwner.current = identity;
    setSession({ mode: 'cloud', data: visibleWorkspace(entry) });
    setStale(false);
  }

  function revoke(identity) {
    identity.revoked = true;
    displayedOwner.current = null;
    setSession({ mode: 'personal', data: loadData('personal') });
  }

  useEffect(() => {
    if (!cloudEnabled) {
      displayedOwner.current = null;
      if (latest.current.session.mode === 'cloud') setSession({ mode: 'personal', data: loadData('personal') });
      setAccount(state => ({ ...state, user: null, loading: false, authResolved: true, hasData: false, ready: false, error: '', pending: false, conflict: null }));
      return;
    }
    let active = true, unsubscribeAuth, unsubscribeData, firstSnapshotTimeout;
    const fail = error => {
      if (!active) return;
      const revoked = error.code === 'permission-denied';
      if (revoked && owner.current) revoke(owner.current);
      setAccount(state => ({ ...state, loading: false, ready: false, error: revoked || !state.hasData ? explainError(error) : '', syncError: explainError(error), ...(revoked && {hasData:false}) }));
    };
    const authTimeout = setTimeout(() => {
      if (!active) return;
      setAccount(state => state.authResolved || state.error ? state : {
        ...state, loading: false, error: 'Не удалось проверить вход. Проверь интернет и повтори подключение.',
      });
    }, WORKSPACE_LOAD_TIMEOUT);
    provider.connect().then(connection => {
      if (!active) return;
      client.current = connection;
      unsubscribeAuth = connection.onAuth(user => {
        if (!active) return;
        clearTimeout(authTimeout);
        clearTimeout(firstSnapshotTimeout);
        unsubscribeData?.();
        const identity = user ? { id: user.id, key: workspaceCacheKey(connection.cacheScope || provider.id, user.id) } : null;
        const sameOwner = identity && displayedOwner.current?.key === identity.key;
        owner.current = identity;
        saving.current = syncing.current = null;
        setStale(false);
        setAccount(state => ({
          ...state, user, loading: false, authResolved: true, hasData: false, ready: false, saving: false,
          error: '', lastSyncedAt: sameOwner ? state.lastSyncedAt : null, syncing: false, syncError: '', pending: false, conflict: null,
        }));
        if (!sameOwner) {
          displayedOwner.current = null;
          if (latest.current.session.mode === 'cloud') setSession({ mode: 'personal', data: loadData('personal') });
        }
        if (!identity) return;
        try { showEntry(readWorkspaceCache(identity.key), identity); }
        catch (error) { fail(error); }
        firstSnapshotTimeout = setTimeout(() => {
          if (!active || owner.current !== identity) return;
          setAccount(state => state.hasData || state.error ? state : {
            ...state, error: 'Не удалось загрузить расписание. Проверь интернет и повтори подключение.',
          });
        }, WORKSPACE_LOAD_TIMEOUT);
        unsubscribeData = connection.subscribe(user.id, (data, fromServer, syncedAt) => {
          if (!active || owner.current !== identity || identity.revoked) return;
          clearTimeout(firstSnapshotTimeout);
          if (fromServer && data.revision > (identity.confirmed?.revision ?? -1)) identity.confirmed = data;
          return updateWorkspaceCache(identity.key, entry => {
            if (owner.current !== identity || identity.revoked || entry?.draft || (entry && data.revision <= entry.base.revision)) return entry;
            return { base: data, draft: null };
          }).then(entry => {
            if (owner.current !== identity || identity.revoked) return;
            setAccount(state => ({ ...state, ready: fromServer || state.ready, error: '',
              ...(fromServer && { lastSyncedAt: Math.max(state.lastSyncedAt || 0, syncedAt || Date.now()) }),
              ...(!fromServer && syncedAt && !state.lastSyncedAt && { lastSyncedAt: syncedAt }),
            }));
            showEntry(entry, identity);
          }).catch(error => {
            if (owner.current === identity) fail(error);
          });
        }, error => {
          if (!active || owner.current !== identity) return;
          clearTimeout(firstSnapshotTimeout);
          fail(error);
        });
      }, error => {
        if (!active) return;
        clearTimeout(authTimeout);
        clearTimeout(firstSnapshotTimeout);
        owner.current = displayedOwner.current = null;
        saving.current = syncing.current = null;
        if (latest.current.session.mode === 'cloud') setSession({ mode: 'personal', data: loadData('personal') });
        setAccount(state => ({ ...state, user: null, hasData: false, authResolved: false, loading: false, ready: false, pending: false, conflict: null, error: explainError(error) }));
      });
    }).catch(error => { clearTimeout(authTimeout); fail(error); });
    return () => {
      active = false;
      clearTimeout(authTimeout);
      clearTimeout(firstSnapshotTimeout);
      unsubscribeAuth?.();
      unsubscribeData?.();
      owner.current = client.current = syncing.current = saving.current = null;
    };
  }, [retry, cloudEnabled, provider]);

  useEffect(() => {
    const changed = event => {
      const identity = owner.current;
      if (identity && !identity.revoked && event.key === identity.key) {
        try { showEntry(readWorkspaceCache(identity.key), identity); }
        catch (error) { setAccount(state => ({ ...state, syncError: explainError(error) })); }
      } else if (event.key === `tutor-schedule:${latest.current.session.mode}:v2`) setStale(true);
    };
    const connectionChanged = () => setAccount(state => ({ ...state, online: navigator.onLine }));
    window.addEventListener('storage', changed);
    window.addEventListener('online', connectionChanged);
    window.addEventListener('offline', connectionChanged);
    return () => {
      window.removeEventListener('storage', changed);
      window.removeEventListener('online', connectionChanged);
      window.removeEventListener('offline', connectionChanged);
    };
  }, [provider]);

  function save(next) {
    const { session: current, account: auth } = latest.current;
    if (current.mode !== session.mode || renderedOwner !== owner.current) throw sessionChanged();
    const expectedRevision = session.data.revision || 0;
    if (current.mode !== 'cloud') {
      const saved = persistData(current.mode, next, expectedRevision);
      setSession({ mode: current.mode, data: saved });
      setStale(false);
      return saved;
    }
    const identity = owner.current;
    if (!identity || identity.revoked || !auth.hasData) throw new Error('Дождись загрузки расписания из аккаунта.');
    if (saving.current) throw new Error('Предыдущее изменение ещё сохраняется на устройстве.');
    const draft = normalizeData(next);
    delete draft.revision;
    const operation = {};
    saving.current = operation;
    setAccount(state => ({ ...state, saving: true }));
    return updateWorkspaceCache(identity.key, entry => {
      if (owner.current !== identity || identity.revoked) throw sessionChanged();
      if (!entry || entry.version !== expectedRevision) {
        setStale(true);
        throw new Error('Расписание изменилось. Обнови данные перед сохранением.');
      }
      if (sameWorkspace(draft, entry.draft || entry.base)) return entry;
      return { ...entry, draft };
    }).then(entry => {
      if (owner.current !== identity || identity.revoked) throw sessionChanged();
      setAccount(state => ({ ...state, conflict: null, syncError: '' }));
      showEntry(entry, identity, true);
      return visibleWorkspace(entry);
    }).finally(() => {
      if (saving.current === operation) {
        saving.current = null;
        setAccount(state => ({ ...state, saving: false }));
      }
    });
  }

  function switchMode(mode) {
    if (saving.current) throw new Error('Дождись сохранения изменений.');
    const identity = owner.current;
    const entry = mode === 'personal' && identity && !identity.revoked ? readWorkspaceCache(identity.key) : null;
    localStorage.setItem('tutor-schedule:mode', mode === 'demo' ? 'demo' : 'personal');
    if (entry) showEntry(entry, identity, true);
    else setSession({ mode, data: loadData(mode) });
    setStale(false);
  }

  function refresh() {
    const { session: current } = latest.current;
    if (current.mode === 'cloud') {
      const identity = owner.current;
      const entry = identity && !identity.revoked && readWorkspaceCache(identity.key);
      if (!entry) throw new Error('На устройстве пока нет копии расписания.');
      showEntry(entry, identity, true);
    } else setSession({ mode: current.mode, data: loadData(current.mode) });
    setStale(false);
  }

  function sync(preference) {
    const identity = owner.current;
    const connection = client.current;
    const { account: auth } = latest.current;
    if (!identity || identity.revoked || !connection || latest.current.session.mode !== 'cloud') return Promise.reject(new Error('Сначала войди в аккаунт.'));
    if (!navigator.onLine) return Promise.reject(new Error('Нет интернета. Изменения остаются на устройстве.'));
    if (syncing.current) return syncing.current.promise;
    const operation = { startedAt: Date.now() };
    syncing.current = operation;
    setAccount(state => ({ ...state, syncing: true, syncError: '' }));
    const assertCurrent = () => { if (owner.current !== identity || identity.revoked) throw sessionChanged(); };
    operation.promise = Promise.resolve().then(async () => {
      assertCurrent();
      const fresh = await readCloud(connection, identity.id);
      assertCurrent();
      if (!Number.isSafeInteger(fresh?.revision) || fresh.revision < 0) throw new Error('Сервис вернул некорректную версию расписания.');
      const entry = readWorkspaceCache(identity.key);
      const plan = planWorkspaceSync(entry, fresh, auth.conflict, preference);
      if (plan.conflict) {
        setAccount(state => ({ ...state, conflict: plan.conflict }));
        return;
      }
      const written = sameWorkspace(plan.data, fresh) ? fresh :
        await connection.save(identity.id, normalizeData(plan.data), fresh.revision);
      assertCurrent();
      const saved = await updateWorkspaceCache(identity.key, current => {
        assertCurrent();
        const confirmed = identity.confirmed?.revision > written.revision ? identity.confirmed : written;
        return checkpointWorkspace(current, entry, confirmed);
      });
      assertCurrent();
      setAccount(state => ({ ...state, ready: true, error: '', conflict: null, lastSyncedAt: (state.lastSyncedAt || 0) >= operation.startedAt ? state.lastSyncedAt : Date.now() }));
      showEntry(saved, identity);
    }).catch(error => {
      if (owner.current === identity) {
        const revoked = error.code === 'permission-denied';
        if (revoked) revoke(identity);
        const syncError = error.code === 'workspace/conflict' ? 'Облако обновилось во время отправки. Повторим синхронизацию.' :
          error.code === 'unavailable' ? 'Облако недоступно. Изменения сохранены на устройстве.' : explainError(error);
        setAccount(state => ({ ...state, syncError,
          ...(revoked && { ready: false, hasData: false, error: explainError(error) }),
        }));
      }
      throw error;
    }).finally(() => {
      if (syncing.current === operation) {
        syncing.current = null;
        setAccount(state => ({ ...state, syncing: false }));
      }
    });
    return operation.promise;
  }

  useEffect(() => {
    if (!cloudEnabled || session.mode !== 'cloud') return;
    const automatic = () => {
      const { account: auth } = latest.current;
      if (document.hidden || !navigator.onLine || auth.conflict || !owner.current || saving.current || syncing.current) return;
      if (!auth.pending && Date.now() - (auth.lastSyncedAt || 0) < 30000) return;
      sync().catch(() => {});
    };
    window.addEventListener('focus', automatic);
    window.addEventListener('online', automatic);
    document.addEventListener('visibilitychange', automatic);
    return () => {
      window.removeEventListener('focus', automatic);
      window.removeEventListener('online', automatic);
      document.removeEventListener('visibilitychange', automatic);
    };
  }, [cloudEnabled, provider, session.mode]);

  useEffect(() => {
    if (!account.pending || !account.online || account.saving || account.syncing || account.conflict || session.mode !== 'cloud') return;
    const timer = setTimeout(() => sync().catch(() => {}), account.syncError ? 20000 : 0);
    return () => clearTimeout(timer);
  }, [account.pending, account.online, account.ready, account.saving, account.syncing, account.conflict, account.syncError, session.mode, session.data.revision]);

  function signIn() {
    if (!client.current || account.loading) return;
    setAccount(state => ({ ...state, loading: true, error: '' }));
    // Invoke directly in the click handler so mobile browsers allow the popup.
    const connection = client.current;
    let result;
    try { result = connection.signIn(); }
    catch (error) { setAccount(state => ({ ...state, loading: false, error: explainError(error) })); return; }
    return Promise.resolve(result).catch(error => {
      if (connection === client.current) setAccount(state => ({ ...state, error: explainError(error) }));
    }).finally(() => {
      if (connection === client.current) setAccount(state => ({ ...state, loading: false }));
    });
  }

  async function signOut() {
    if (saving.current || syncing.current) throw new Error('Дождись сохранения изменений.');
    await client.current.signOut();
  }

  function reconnect() {
    setAccount(state => ({ ...state, error: '', loading: !state.authResolved }));
    setRetry(value => value + 1);
  }

  function pendingCopy() {
    const identity = owner.current;
    const entry = identity && !identity.revoked && readWorkspaceCache(identity.key);
    if (!entry) throw new Error('На устройстве пока нет копии расписания.');
    return visibleWorkspace(entry);
  }

  return { session, account, stale, save, switchMode, refresh, sync, signIn, signOut, reconnect, pendingCopy };
}
