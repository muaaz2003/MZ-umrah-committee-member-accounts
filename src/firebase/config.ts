import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

// CRITICAL: Bind to the specific provisioned firestoreDatabaseId with auto-detect long polling
// to ensure stable communication through proxies, Cloud Run, and sandboxed iframes.
export const db = initializeFirestore(
  app,
  {
    experimentalAutoDetectLongPolling: true,
  },
  firebaseConfig.firestoreDatabaseId
);
export const auth = getAuth(app);

// Test server connection as mandated in skill guidelines
export async function testFirebaseConnection() {
  try {
    await getDocFromServer(doc(db, 'settings', 'test-connection'));
    console.log('Firebase connection verified.');
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes('the client is offline') ||
        error.message.includes('unavailable') ||
        (error as any).code === 'unavailable')
    ) {
      console.warn('Firebase client operating in offline/cache mode until connection is re-established.');
    } else {
      console.warn('Firebase connection notice:', error);
    }
  }
}
testFirebaseConnection();
