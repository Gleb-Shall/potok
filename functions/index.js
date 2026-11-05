import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { activeReminders, reminderMessage } from './reminder-model.js';

initializeApp();
const db = getFirestore();
const DAY = 86400000;
const terminal = receipt => ['sent','expired'].includes(receipt?.state);
const parse = document => JSON.parse(document.payload);

async function deliver(reference, reminderId, uid, now) {
  const receiptRef = db.doc(`users/${uid}/reminderDeliveries/${reminderId}`);
  const claim = await db.runTransaction(async transaction => {
    const [workspace,receipt] = await Promise.all([transaction.get(reference),transaction.get(receiptRef)]);
    if (!workspace.exists) return;
    const data = parse(workspace.data());
    const reminder = activeReminders(data).find(item=>item.id === reminderId && Date.parse(item.at) <= now);
    const previous = receipt.data() || {};
    if (!reminder || terminal(previous) || previous.leaseUntil > now) return;
    if (Date.parse(reminder.at) < now-DAY) { transaction.set(receiptRef,{state:'expired',updatedAt:now});return; }
    const lease = crypto.randomUUID();
    transaction.set(receiptRef,{...previous,state:'sending',lease,leaseUntil:now+120000,updatedAt:now});
    return {data,reminder,lease,sentDevices:previous.sentDevices || []};
  });
  if (!claim) return;
  const devices = await db.collection(`users/${uid}/pushDevices`).limit(20).get();
  const targets = devices.docs.filter(device => !claim.sentDevices.includes(device.id));
  const sentDevices = new Set(claim.sentDevices);
  let retry = false;
  if (targets.length) {
    // Re-check the live event immediately before sending: a move cancels delivery.
    const latest = await reference.get();
    const current = latest.exists ? parse(latest.data()) : null;
    if (!current || !activeReminders(current).some(item=>item.id === reminderId)) return;
    const message = reminderMessage(current,claim.reminder);
    const results = await getMessaging().sendEachForMulticast({
      tokens:targets.map(device=>device.data().token),
      data:{...message,uid},
      webpush:{headers:{TTL:'86400',Urgency:'normal'}},
    });
    for (let index=0;index<results.responses.length;index++) {
      const result = results.responses[index], device = targets[index];
      if (result.success) sentDevices.add(device.id);
      else if (['messaging/registration-token-not-registered','messaging/invalid-registration-token'].includes(result.error?.code)) await device.ref.delete();
      else retry = true;
    }
  }
  await db.runTransaction(async transaction => {
    const receipt = await transaction.get(receiptRef);
    if (receipt.data()?.lease !== claim.lease) return;
    transaction.set(receiptRef,{state:!retry && sentDevices.size ? 'sent':'pending',sentDevices:[...sentDevices],leaseUntil:0,updatedAt:now});
  });
}

async function refreshIndex(reference,uid,now) {
  await db.runTransaction(async transaction => {
    const workspace = await transaction.get(reference);
    if (!workspace.exists) return;
    const reminders = activeReminders(parse(workspace.data()));
    const receipts = reminders.length ? await transaction.getAll(...reminders.map(item=>db.doc(`users/${uid}/reminderDeliveries/${item.id}`))) : [];
    const remaining = reminders.filter((_,index)=>!terminal(receipts[index]?.data()));
    const next = remaining.length ? Math.min(...remaining.map(item=>Math.max(Date.parse(item.at),now+60000))) : 0;
    // This delivery index is independent of the user's editing revision/payload.
    transaction.update(reference,{nextReminderAt:next});
  });
}

export const sendEventReminders = onSchedule({
  schedule:'every 1 minutes',timeZone:'UTC',region:'europe-west1',
  memory:'256MiB',timeoutSeconds:120,maxInstances:1,concurrency:1,retryCount:0,
},async()=>{
  const now = Date.now();
  const workspaces = await db.collectionGroup('workspaces').where('nextReminderAt','>',0).where('nextReminderAt','<=',now).limit(50).get();
  const errors = [];
  for (const workspace of workspaces.docs) {
    // Only the existing personal workspace layout is an eligible source.
    if (!/^users\/[^/]+\/workspaces\/main$/.test(workspace.ref.path)) continue;
    const uid = workspace.ref.parent.parent.id;
    try {
      for (const reminder of activeReminders(parse(workspace.data())).filter(item=>Date.parse(item.at)<=now)) await deliver(workspace.ref,reminder.id,uid,now);
      await refreshIndex(workspace.ref,uid,now);
    } catch (error) { errors.push(error); console.error('Reminder delivery failed',{code:error.code || error.name}); }
  }
  if (errors.length) throw new AggregateError(errors,'Some reminders require retry');
});
