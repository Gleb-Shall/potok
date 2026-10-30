import { prepareWorkspace, readWorkspace } from './cloud-workspace.js';

export const firebaseConfig = {
  apiKey: 'AIzaSyDZ8PfDofgUf8qth2LWZ3KlMiFTI1Sv_-U',
  authDomain: 'potok-planner.web.app',
  projectId: 'tutor-s-lesson-schedule-b392f',
  storageBucket: 'tutor-s-lesson-schedule-b392f.firebasestorage.app',
  messagingSenderId: '461554263763',
  appId: '1:461554263763:web:bc858cc6bbdcfad84c1626'
};

let connection;
export function connectFirebase() {
  if (!connection) connection = loadFirebase().catch(error => { connection = undefined; throw error; });
  return connection;
}

async function loadFirebase() {
  const [appSDK, authSDK, dbSDK] = await Promise.all([
    import('firebase/app'), import('firebase/auth'), import('firebase/firestore')
  ]);
  const app = appSDK.getApps().length ? appSDK.getApp() : appSDK.initializeApp(firebaseConfig);
  const auth = authSDK.getAuth(app);
  auth.languageCode = 'ru';
  const db = dbSDK.getFirestore(app);
  // Memory cache avoids retaining another account's private schedule on a shared device.
  const workspace = uid => dbSDK.doc(db, 'users', uid, 'workspaces', 'main');
  const provider = new authSDK.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  return {
    onAuth: (callback, onError) => authSDK.onAuthStateChanged(auth, callback, onError),
    signIn: () => authSDK.signInWithPopup(auth, provider),
    signOut: () => authSDK.signOut(auth),
    subscribe(uid, callback, onError) {
      return dbSDK.onSnapshot(workspace(uid), { includeMetadataChanges: true }, snapshot => {
        try { callback(readWorkspace(snapshot.exists() ? snapshot.data() : null), !snapshot.metadata.fromCache); }
        catch (error) { onError(error); }
      }, onError);
    },
    save(uid, data, expectedRevision) {
      return dbSDK.runTransaction(db, async transaction => {
        const reference = workspace(uid);
        const snapshot = await transaction.get(reference);
        const document = prepareWorkspace(data, expectedRevision, snapshot.exists() ? snapshot.data() : null);
        transaction.set(reference, { ...document, updatedAt: dbSDK.serverTimestamp() });
        return readWorkspace(document);
      });
    }
  };
}

export function explainFirebaseError(error) {
  const messages = {
    'permission-denied': 'Нет доступа к расписанию. Попробуй выйти из аккаунта и войти снова.',
    'auth/unauthorized-domain': 'Вход с этого адреса пока не разрешён в настройках Firebase Authentication.',
    'auth/operation-not-allowed': 'Вход через Google не включён в Firebase Authentication.',
    'auth/popup-blocked': 'Браузер заблокировал окно входа. Разреши всплывающие окна для этого сайта и повтори вход.',
    'auth/popup-closed-by-user': 'Окно входа закрыто. Можно попробовать ещё раз.',
    'auth/cancelled-popup-request': 'Другое окно входа уже открыто.',
    'auth/network-request-failed': 'Не удалось связаться с Google. Проверь интернет и повтори вход.',
    'unavailable': 'Нет связи с базой. Изменения не сохранены; проверь интернет и повтори действие.',
    'resource-exhausted': 'Достигнут лимит Firebase. Попробуй позже или проверь использование проекта.'
  };
  return messages[error.code] || error.message || 'Не удалось выполнить действие. Попробуй ещё раз.';
}
