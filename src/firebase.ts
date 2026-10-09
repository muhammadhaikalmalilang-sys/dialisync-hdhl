import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeFirestore, getFirestore, Firestore, doc, getDocFromServer } from 'firebase/firestore';
import { getAuth, signInAnonymously } from 'firebase/auth';
import firebaseConfig from '../firebase-applet-config.json';

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

const dbId =
  firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)'
    ? firebaseConfig.firestoreDatabaseId
    : undefined;

let firestoreInstance: Firestore;
try {
  firestoreInstance = dbId ? getFirestore(app, dbId) : getFirestore(app);
} catch {
  firestoreInstance = initializeFirestore(
    app,
    {},
    dbId
  );
}

export const db: Firestore = firestoreInstance;
export const auth = getAuth(app);
export { app };

// Automatically ensure auth state if anonymous auth is configured
signInAnonymously(auth).catch(() => {
  // If anonymous auth is not enabled, unauthenticated access is supported via firestore rules
});

// Test connection on boot according to skill specifications
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && (
      error.message.includes('the client is offline') || 
      error.message.includes('unavailable') ||
      error.message.includes('resource-exhausted') ||
      error.message.includes('quota')
    )) {
      console.warn('[Firebase] Operating in offline mode or waiting for connection / quota reset.');
    }
  }
}
testConnection();

