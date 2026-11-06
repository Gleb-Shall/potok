import { createWorkspaceProvider } from '../../lib/workspace-provider.js';
import { readWorkspace, prepareWorkspace } from './workspace.js';
import { validateFirebaseConfig, getFirebaseConfig } from './config.js';
import { createFirebaseNotifications } from './notifications.js';

const databases=import.meta.hot?.data.databases || new WeakMap();
if (import.meta.hot) import.meta.hot.dispose(data=>{data.databases=databases;});

// Optional SDK adapter. The local application never imports this module.
export function createFirebaseProvider({ config = getFirebaseConfig, appName = '[DEFAULT]' } = {}) {
  let runtime;
  const notifications=createFirebaseNotifications(()=>runtime,()=>provider.connect());
  const provider=createWorkspaceProvider({
    id:'firebase', name:'Firebase', signInLabel:'Войти через Google', entryLabel:'Продолжить с Google', accountLabel:'Google-аккаунт',
    explainError:explainFirebaseError, notifications,
    async connect() {
      const value=typeof config==='function' ? config() : config;
      if (!value) throw new Error('Сначала настрой подключение Firebase.');
      const firebaseConfig=validateFirebaseConfig(value);
      const [appSDK,authSDK,dbSDK]=await Promise.all([import('firebase/app'),import('firebase/auth'),import('firebase/firestore')]);
      // Preserve the existing Firebase Auth/Firestore cache names during migration.
      const app=appSDK.initializeApp(firebaseConfig,appName);
      const auth=authSDK.getAuth(app);auth.languageCode='ru';
      let db=databases.get(app);
      if (!db) {
        db=dbSDK.initializeFirestore(app,{localCache:typeof indexedDB==='undefined' ? dbSDK.memoryLocalCache() : dbSDK.persistentLocalCache({tabManager:dbSDK.persistentMultipleTabManager()})});
        databases.set(app,db);
      }
      runtime={app,auth,db};
      const workspace=userId=>dbSDK.doc(db,'users',userId,'workspaces','main');
      const google=new authSDK.GoogleAuthProvider();google.setCustomParameters({prompt:'select_account'});
      return {
        auth:{
          subscribe:(callback,onError)=>authSDK.onAuthStateChanged(auth,user=>callback(user ? {id:user.uid,displayName:user.displayName || '',email:user.email || '',photoURL:user.photoURL || ''} : null),onError),
          signIn:()=>authSDK.signInWithPopup(auth,google),
          signOut:async()=>{await notifications.disable(auth.currentUser ? {id:auth.currentUser.uid} : null);await authSDK.signOut(auth);},
        },
        storage:{
          subscribe(userId,callback,onError) {
            return dbSDK.onSnapshot(workspace(userId),{includeMetadataChanges:true},snapshot=>{
              if (snapshot.metadata.fromCache && !snapshot.exists()) return;
              try {callback(readWorkspace(snapshot.exists()?snapshot.data():null),!snapshot.metadata.fromCache && !snapshot.metadata.hasPendingWrites);}
              catch(error) {onError(error);}
            },onError);
          },
          async read(userId) {
            const snapshot=await dbSDK.getDocFromServer(workspace(userId));
            return readWorkspace(snapshot.exists()?snapshot.data():null);
          },
          compareAndSwap(userId,data,expectedRevision) {
            return dbSDK.runTransaction(db,async transaction=>{
              const reference=workspace(userId),snapshot=await transaction.get(reference);
              const document=prepareWorkspace(data,expectedRevision,snapshot.exists()?snapshot.data():null,{publishReminders:notifications.enabled});
              transaction.set(reference,{...document,updatedAt:dbSDK.serverTimestamp()});
              return readWorkspace(document);
            });
          },
        },
        metadata:{
          readSync(userId) {try {const value=Number(localStorage.getItem(`potok:last-sync:${userId}`));return Number.isFinite(value)&&value>0&&value<=Date.now()?value:null;}catch{return null;}},
          rememberSync(userId,at) {try {localStorage.setItem(`potok:last-sync:${userId}`,String(at));}catch {/* Optional metadata must not invalidate a confirmed save. */}},
        },
      };
    },
  });
  return provider;
}

export function explainFirebaseError(error) {
  const messages={
    'permission-denied':'Нет доступа к расписанию. Попробуй выйти из аккаунта и войти снова.',
    'auth/unauthorized-domain':'Вход с этого адреса пока не разрешён в настройках Firebase Authentication.',
    'auth/operation-not-allowed':'Вход через Google не включён в Firebase Authentication.',
    'auth/popup-blocked':'Браузер заблокировал окно входа. Разреши всплывающие окна для этого сайта и повтори вход.',
    'auth/popup-closed-by-user':'Окно входа закрыто. Можно попробовать ещё раз.',
    'auth/cancelled-popup-request':'Другое окно входа уже открыто.',
    'auth/network-request-failed':'Не удалось связаться с Google. Проверь интернет и повтори вход.',
    'unavailable':'Нет связи с базой. Изменения не сохранены; проверь интернет и повтори действие.',
    'resource-exhausted':'Достигнут лимит Firebase. Попробуй позже или проверь использование проекта.',
  };
  return messages[error?.code] || error?.message || 'Не удалось выполнить действие. Попробуй ещё раз.';
}
