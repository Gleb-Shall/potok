// Keep the verified account and its live workspace across page mounts.
// Never expose a previous account's snapshot after an auth change.
export function createAccountSession(transport) {
  let user = null, resolved = false, data = null, fromServer = false, error = null, watch = null;
  let lastSyncedAt = null, generation = 0, disposed = false;
  const authListeners = new Set();
  const dataListeners = new Set();
  function publish(next,server) {
    if (data && next.revision < data.revision) return data;
    if (!server && fromServer && data && next.revision === data.revision) return data;
    data=next;fromServer=server;error=null;
    if(server) {lastSyncedAt=Date.now();transport.rememberSync?.(user.id,lastSyncedAt);}
    for(const listener of dataListeners) if(listener.userId===user?.id) listener.callback(data,server,lastSyncedAt);
    return data;
  }
  function ensureWatch() {
    if (!user || watch) return;
    const current = { userId: user.id, stop: null };
    watch = current;
    current.stop = transport.subscribe(current.userId, (next, server) => {
      if (watch !== current || user?.id !== current.userId) return;
      publish(next,server);
    }, failure => {
      if (watch !== current) return;
      watch = null; current.stop?.(); error = failure; fromServer = false;
      if (failure.code === 'permission-denied') data = null;
      for (const listener of dataListeners) if (listener.userId === current.userId) listener.onError?.(failure);
    });
    if (watch !== current) current.stop?.();
  }
  const stopAuth=transport.onAuth(nextUser => {
    if (disposed) return;
    if (nextUser?.id !== user?.id) {
      const previous = watch;
      watch = null; previous?.stop?.();
      data = null; fromServer = false;lastSyncedAt=null;generation++;
    }
    user = nextUser; resolved = true; error = null;
    if(user && !lastSyncedAt) lastSyncedAt=transport.readSync?.(user.id) || null;
    for (const listener of authListeners) listener.callback(user);
    ensureWatch();
  }, failure => {
    if (disposed) return;
    const previous = watch;
    watch = null; previous?.stop?.();
    user = null; data = null; fromServer = false; resolved = false; error = failure;lastSyncedAt=null;generation++;
    for (const listener of authListeners) listener.onError?.(failure);
  });
  return {
    ...transport,
    dispose() {
      if (disposed) return;
      disposed=true;generation++;stopAuth?.();watch?.stop?.();watch=null;
      user=null;data=null;resolved=false;fromServer=false;lastSyncedAt=null;error=null;
      authListeners.clear();dataListeners.clear();
    },
    getSession: () => ({ user, resolved, data, fromServer, error, lastSyncedAt }),
    async fetch(userId) {
      if(user?.id!==userId) throw new Error('Аккаунт изменился. Открой расписание заново.');
      const started=generation;
      const next=await transport.fetch(userId);
      if(user?.id!==userId || generation!==started) throw new Error('Аккаунт изменился. Открой расписание заново.');
      const result=publish(next,true);ensureWatch();return result;
    },
    async save(userId,next,revision) {
      if(user?.id!==userId) throw new Error('Аккаунт изменился. Открой расписание заново.');
      const started=generation;
      const saved=await transport.save(userId,next,revision);
      if(user?.id!==userId || generation!==started) throw new Error('Аккаунт изменился. Открой расписание заново.');
      return publish(saved,true);
    },
    onAuth(callback, onError) {
      const listener = { callback, onError };
      authListeners.add(listener);
      if (resolved) callback(user);
      else if (error) onError?.(error);
      return () => authListeners.delete(listener);
    },
    subscribe(userId, callback, onError) {
      if (!user || user.id !== userId) {
        onError?.(new Error('Аккаунт изменился. Открой расписание заново.'));
        return () => {};
      }
      const listener = { userId, callback, onError };
      dataListeners.add(listener);
      if (data) callback(data, fromServer, lastSyncedAt);
      ensureWatch();
      return () => dataListeners.delete(listener);
    }
  };
}
