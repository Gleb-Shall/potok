import { createAccountSession } from './account-session.js';

export class WorkspaceConflictError extends Error {
  constructor() {
    super('Расписание изменилось на другом устройстве. Обнови данные перед сохранением. Черновик остаётся открытым.');
    this.name = 'WorkspaceConflictError';
    this.code = 'workspace/conflict';
  }
}

export const explainWorkspaceError = error => error?.message || 'Не удалось выполнить действие. Попробуй ещё раз.';

/**
 * The adapter supplies independent auth and storage services. The common session
 * owns caching, identity changes and listener lifetime; it contains no SDK types.
 * storage.compareAndSwap MUST check expectedRevision atomically on the server.
 */
export function createWorkspaceProvider({ id, name, connect, signInLabel = 'Войти', entryLabel = signInLabel, accountLabel = name, explainError = explainWorkspaceError, Settings, notifications }) {
  if (!id || typeof connect !== 'function') throw new Error('Для подключения нужны id и connect.');
  let pending, session, generation=0;
  return {
    id, name, signInLabel, entryLabel, accountLabel, explainError, Settings, notifications,
    getSession: () => session?.getSession(),
    connect() {
      if (pending) return pending;
      const expected=generation;
      pending = Promise.resolve().then(connect).then(({ auth, storage, metadata, dispose }) => {
        if (generation!==expected) {dispose?.();throw new Error('Подключение закрыто.');}
        for (const [service, methods] of [[auth,['subscribe','signIn','signOut']],[storage,['subscribe','read','compareAndSwap']]]) {
          for (const method of methods) if (typeof service?.[method] !== 'function') {dispose?.();throw new Error(`Адаптер ${id}: не реализован ${method}.`);}
        }
        session = createAccountSession({
          onAuth: (callback,onError) => auth.subscribe(user=>{
            if (!user) return callback(null);
            if (typeof user.id!=='string' || !user.id.trim()) return onError?.(new Error(`Адаптер ${id}: у аккаунта нет id.`));
            const {id:userId,displayName,email,photoURL}=user;
            callback({id:userId,displayName:displayName || '',email:email || '',photoURL:photoURL || ''});
          },onError),
          signIn: () => auth.signIn(),
          signOut: () => auth.signOut(),
          subscribe: (userId,callback,onError) => storage.subscribe(userId,callback,onError),
          fetch: userId => storage.read(userId),
          save: (userId,data,revision) => storage.compareAndSwap(userId,data,revision),
          readSync: userId => metadata?.readSync?.(userId),
          rememberSync: (userId,at) => metadata?.rememberSync?.(userId,at),
        });
        const disposeSession=session.dispose;
        let closed=false;
        session.dispose=()=>{if(closed)return;closed=true;disposeSession();dispose?.();};
        return session;
      }).catch(error => { if (expected===generation) pending = undefined; throw error; });
      return pending;
    },
    dispose() { generation++;session?.dispose();session=undefined;pending=undefined; },
  };
}

/** Every cloud mutation reads authoritative data, then uses a server-side CAS.
 * A preflight read alone cannot protect the race between reading and writing.
 */
export async function saveWithFreshData(connection, userId, next, expectedRevision, { assertCurrent = () => {}, onFresh = () => {} } = {}) {
  assertCurrent();
  const fresh = await connection.fetch(userId);
  assertCurrent();
  if (!Number.isSafeInteger(fresh?.revision) || fresh.revision < 0) throw new Error('Сервис не вернул корректную версию расписания. Изменения не сохранены.');
  onFresh(fresh);
  if (fresh.revision !== expectedRevision) throw new WorkspaceConflictError();
  assertCurrent();
  const saved = await connection.save(userId,next,expectedRevision);
  assertCurrent();
  return saved;
}
