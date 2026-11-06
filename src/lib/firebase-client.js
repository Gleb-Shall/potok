// Compatibility entry for existing integrations; the core does not import it.
import { createFirebaseProvider } from '../adapters/firebase/index.js';
export { explainFirebaseError } from '../adapters/firebase/index.js';
export let firebaseProvider=createFirebaseProvider();
let explicitConfig;
export const connectFirebase=config=>{
  if (config && JSON.stringify(config)!==explicitConfig) {
    explicitConfig=JSON.stringify(config);
    firebaseProvider.dispose();
    firebaseProvider=createFirebaseProvider({config});
  }
  return firebaseProvider.connect();
};
export const getFirebaseSession=()=>firebaseProvider.getSession();
