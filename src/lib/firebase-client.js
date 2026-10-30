export const firebaseConfig = {
  apiKey: 'AIzaSyDZ8PfDofgUf8qth2LWZ3KlMiFTI1Sv_-U',
  authDomain: 'tutor-s-lesson-schedule-b392f.firebaseapp.com',
  projectId: 'tutor-s-lesson-schedule-b392f',
  storageBucket: 'tutor-s-lesson-schedule-b392f.firebasestorage.app',
  messagingSenderId: '461554263763',
  appId: '1:461554263763:web:bc858cc6bbdcfad84c1626'
};

let connection;
export function connectFirebase() {
  if (!connection) {
    connection = loadFirebase().catch(error => { connection = undefined; throw error; });
  }
  return connection;
}

async function loadFirebase() {
  const base = 'https://www.gstatic.com/firebasejs/13.1.0';
  const [appSDK, authSDK, dbSDK] = await Promise.all([
    import(`${base}/firebase-app.js`), import(`${base}/firebase-auth.js`), import(`${base}/firebase-firestore.js`)
  ]);
  const app = appSDK.initializeApp(firebaseConfig);
  const auth = authSDK.getAuth(app);
  const db = dbSDK.getFirestore(app);
  return {
    onAuth: callback => authSDK.onAuthStateChanged(auth, callback),
    signIn: () => authSDK.signInWithPopup(auth, new authSDK.GoogleAuthProvider()),
    signOut: () => authSDK.signOut(auth),
    subscribe(uid, name, callback, onError) {
      return dbSDK.onSnapshot(dbSDK.collection(db, 'users', uid, name), { includeMetadataChanges: true }, snapshot => {
        callback(snapshot.docs.map(document => ({ ...document.data(), id: document.id })), {
          pending: snapshot.metadata.hasPendingWrites, cached: snapshot.metadata.fromCache
        });
      }, onError);
    },
    async save(uid, collectionName, record) {
      const { id, ...fields } = record;
      await dbSDK.setDoc(dbSDK.doc(db, 'users', uid, collectionName, id), fields);
    }
  };
}

export function explainFirebaseError(error) {
  const messages = {
    'permission-denied': 'Нет доступа к базе. Опубликуй правила Firestore из раздела «Подключение» и обнови страницу.',
    'auth/unauthorized-domain': 'Этот адрес не разрешён для входа. В Firebase → Authentication → Settings → Authorized domains добавь localhost или 127.0.0.1 — тот адрес, по которому открыто приложение.',
    'auth/operation-not-allowed': 'Включи Google в Firebase → Authentication → Sign-in method.',
    'auth/popup-blocked': 'Браузер заблокировал окно входа. Разреши всплывающие окна для этого сайта и повтори вход.',
    'auth/popup-closed-by-user': 'Окно входа закрыто. Нажми «Войти через Google», чтобы попробовать ещё раз.',
    'auth/network-request-failed': 'Не удалось связаться с Google. Проверь интернет и повтори вход.',
    'unavailable': 'База временно недоступна. Проверь соединение и повтори действие.',
    'resource-exhausted': 'Достигнут лимит Firebase. Проверь использование проекта в консоли.'
  };
  return messages[error.code] || `Не удалось выполнить действие. ${error.message || 'Проверь соединение и повтори попытку.'}`;
}
