// Keep the verified account and its live workspace across page mounts.
// Never expose a previous account's snapshot after an auth change.
export function createAccountSession(transport) {
  let user = null, resolved = false, data = null, fromServer = false, error = null, watch = null;
  const authListeners = new Set();
  const dataListeners = new Set();
  function ensureWatch() {
    if (!user || watch) return;
    const current = { uid: user.uid, stop: null };
    watch = current;
    current.stop = transport.subscribe(current.uid, (next, server) => {
      if (watch !== current || user?.uid !== current.uid) return;
      data = next; fromServer = server; error = null;
      for (const listener of dataListeners) if (listener.uid === current.uid) listener.callback(next, server);
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
      data = null; fromServer = false;
    }
    user = nextUser; resolved = true; error = null;
    for (const listener of authListeners) listener.callback(user);
    ensureWatch();
  }, failure => {
    const previous = watch;
    watch = null; previous?.stop?.();
    user = null; data = null; fromServer = false; resolved = false; error = failure;
    for (const listener of authListeners) listener.onError?.(failure);
  });
  return {
    ...transport,
    getSession: () => ({ user, resolved, data, fromServer, error }),
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
      if (data) callback(data, fromServer);
      ensureWatch();
      return () => dataListeners.delete(listener);
    }
  };
}
