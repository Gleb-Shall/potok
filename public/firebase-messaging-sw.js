/* FCM uses this PushSubscription; native handlers avoid another SDK in the worker. */
self.addEventListener('push', event => {
  let data;
  try { data = event.data.json().data; } catch { return; }
  if (!data?.eventId || !data?.uid || !data?.reminderId) return;
  event.waitUntil(self.registration.showNotification(String(data.title || 'Событие').slice(0,200), {
    body:String(data.body || 'Всё ещё ждёт переноса.').slice(0,300),
    tag:`potok-reminder:${data.reminderId}`, renotify:false,
    data:{eventId:data.eventId,uid:data.uid},
  }));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const {eventId,uid} = event.notification.data || {};
  if (!eventId || !uid) return;
  const url = new URL('/app', self.location.origin);
  url.searchParams.set('event',eventId);url.searchParams.set('uid',uid);
  event.waitUntil(self.clients.openWindow(url.href));
});
