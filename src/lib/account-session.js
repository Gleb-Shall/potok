// Keep the verified account and its live workspace across page mounts.
// Never expose a previous account's snapshot after an auth change.
export function createAccountSession(transport) {
  let user = null, resolved = false, data = null, fromServer = false, error = null, watch = null;
  let lastSyncedAt = null, generation = 0;
  const authListeners = new Set();
  const dataListeners = new Set();
  function publish(next,server) {
    if (data && next.revision < data.revision) return data;
    if (!server && fromServer && data && next.revision === data.revision) return data;
    data=next;fromServer=server;error=null;
    if(server) {lastSyncedAt=Date.now();transport.rememberSync?.(user.uid,lastSyncedAt);}
    for(const listener of dataListeners) if(listener.uid===user?.uid) listener.callback(data,server,lastSyncedAt);
    return data;
  }
  function ensureWatch() {
    if (!user || watch) return;
    const current = { uid: user.uid, stop: null };
    watch = current;
    current.stop = transport.subscribe(current.uid, (next, server) => {
      if (watch !== current || user?.uid !== current.uid) return;
      publish(next,server);
    }, failure => {
      if (watch !== current) return;
      watch = null; current.stop?.(); error = failure; fromServer = false;
      if (failure.code === 'permission-denied') data = null;
      for (const listener of dataListeners) if (listener.uid === current.uid) listener.onError?.(failure);
    });
    if (watch !== current) current.stop?.();
  }
  transport.onAuth(nextUser => {
    if (nextUser?.uid !== user?.uid) {
      const previous = watch;
      watch = null; previous?.stop?.();
      data = null; fromServer = false;lastSyncedAt=null;generation++;
    }
    user = nextUser; resolved = true; error = null;
    if(user && !lastSyncedAt) lastSyncedAt=transport.readSync?.(user.uid) || null;
    for (const listener of authListeners) listener.callback(user);
    ensureWatch();
  }, failure => {
    const previous = watch;
    watch = null; previous?.stop?.();
    user = null; data = null; fromServer = false; resolved = false; error = failure;lastSyncedAt=null;generation++;
    for (const listener of authListeners) listener.onError?.(failure);
  });
  return {
    ...transport,
    getSession: () => ({ user, resolved, data, fromServer, error, lastSyncedAt }),
    async fetch(uid) {
      if(user?.uid!==uid) throw new Error('Аккаунт изменился. Открой расписание заново.');
      const started=generation;
      const next=await transport.fetch(uid);
      if(user?.uid!==uid || generation!==started) throw new Error('Аккаунт изменился. Открой расписание заново.');
      const result=publish(next,true);ensureWatch();return result;
    },
    async save(uid,next,revision) {
      if(user?.uid!==uid) throw new Error('Аккаунт изменился. Открой расписание заново.');
      const started=generation;
      const saved=await transport.save(uid,next,revision);
      if(user?.uid!==uid || generation!==started) throw new Error('Аккаунт изменился. Открой расписание заново.');
      return publish(saved,true);
    },
    onAuth(callback, onError) {
      const listener = { callback, onError };
      authListeners.add(listener);
      if (resolved) callback(user);
      else if (error) onError?.(error);
      return () => authListeners.delete(listener);
    },
    subscribe(uid, callback, onError) {
      if (!user || user.uid !== uid) {
        onError?.(new Error('Аккаунт изменился. Открой расписание заново.'));
        return () => {};
      }
      const listener = { uid, callback, onError };
      dataListeners.add(listener);
      if (data) callback(data, fromServer, lastSyncedAt);
      ensureWatch();
      return () => dataListeners.delete(listener);
    }
  };
}
