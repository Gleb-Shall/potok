// Compatibility entry. New integrations inject provider.notifications into App.
import { firebaseProvider } from './firebase-client.js';
export const PUSH_READY=firebaseProvider.notifications.enabled;
export const enablePushForUser=user=>firebaseProvider.notifications.enable(user);
export const disablePushForUser=user=>firebaseProvider.notifications.disable(user);
