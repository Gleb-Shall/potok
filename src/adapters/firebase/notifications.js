const vapidKey = import.meta.env?.VITE_FIREBASE_VAPID_KEY || '';
export const PUSH_READY = import.meta.env?.VITE_EVENT_PUSH_ENABLED === 'true' && Boolean(vapidKey);
export function createFirebaseNotifications(getRuntime,connectFirebase) {
  async function pushClient() {
    await connectFirebase();
    const [dbSDK, messaging] = await Promise.all([import('firebase/firestore'),import('firebase/messaging')]);
    if (!await messaging.isSupported()) throw new Error('Этот браузер не поддерживает push. На iPhone открой приложение с домашнего экрана.');
    const {app,auth,db}=getRuntime();
    return {auth,db,messaging:messaging.getMessaging(app),sdk:dbSDK,push:messaging};
  }
  async function enablePushForUser(user) {
    if (!PUSH_READY) throw new Error('Push-уведомления пока не подключены к Firebase.');
    if (!user || !window.isSecureContext || !('Notification' in window) || !('serviceWorker' in navigator)) throw new Error('Для уведомлений нужен вход в аккаунт и поддерживающий их браузер.');
    // Permission must be requested directly from a user gesture, before loading SDKs.
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') throw new Error('Уведомления не разрешены. Их можно включить в настройках сайта.');
    const client = await pushClient();
    if (client.auth.currentUser?.uid !== user.id) throw new Error('Аккаунт изменился. Открой карточку заново.');
    const previous = JSON.parse(localStorage.getItem('potok:push-device') || 'null');
    if (previous?.uid && previous.uid !== user.id) await client.push.deleteToken(client.messaging);
    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    const token = await client.push.getToken(client.messaging, {vapidKey,serviceWorkerRegistration:registration});
    if (!token) throw new Error('Не удалось включить уведомления. Попробуй ещё раз.');
    if (client.auth.currentUser?.uid !== user.id) { await client.push.deleteToken(client.messaging); throw new Error('Аккаунт изменился. Повтори подключение уведомлений.'); }
    const digest = await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token));
    const id = Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('');
    await client.sdk.setDoc(client.sdk.doc(client.db,'users',user.id,'pushDevices',id),{token,updatedAt:client.sdk.serverTimestamp()});
    localStorage.setItem('potok:push-device',JSON.stringify({uid:user.id,id}));
  }
  async function disablePushForUser(user) {
    const device = JSON.parse(localStorage.getItem('potok:push-device') || 'null');
    if (!device || device.uid !== user?.id) return;
    const client = await pushClient();
    await client.push.deleteToken(client.messaging);
    await client.sdk.deleteDoc(client.sdk.doc(client.db,'users',user.id,'pushDevices',device.id));
    localStorage.removeItem('potok:push-device');
  }

  return {enabled:PUSH_READY,enable:enablePushForUser,disable:disablePushForUser};
}
