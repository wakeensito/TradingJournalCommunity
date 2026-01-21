/**
 * Firebase Configuration
 * Initialize Firebase services synchronously at module load
 */

import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';

// Firebase configuration
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'trading-journal-9209f',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || ''
};

// Initialize Firebase app (only if not already initialized and config is valid)
let app: FirebaseApp | null = null;
let db: Firestore | null = null;
let auth: Auth | null = null;

try {
  // Check if Firebase is already initialized
  const existingApps = getApps();
  
  if (existingApps.length > 0) {
    // Use existing app
    app = existingApps[0];
  } else if (firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.apiKey !== '') {
    // Initialize new app
    app = initializeApp(firebaseConfig);
  }

  // Initialize services if app is available
  if (app) {
    db = getFirestore(app);
    auth = getAuth(app);
  } else {
    console.warn('Firebase not initialized: Missing configuration. Using localStorage fallback.');
  }
} catch (error) {
  console.error('Firebase initialization failed:', error);
  console.warn('Falling back to localStorage');
  app = null;
  db = null;
  auth = null;
}

// Async initialization function for cases where we need to ensure initialization
async function initializeFirebase(): Promise<{ app: FirebaseApp | null; db: Firestore | null; auth: Auth | null }> {
  // If already initialized, return existing instances
  if (app !== null && db !== null && auth !== null) {
    return { app, db, auth };
  }

  // Try to initialize if config is available
  if (firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.apiKey !== '') {
    try {
      const existingApps = getApps();
      if (existingApps.length === 0) {
        app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        auth = getAuth(app);
      } else {
        app = existingApps[0];
        db = getFirestore(app);
        auth = getAuth(app);
      }
    } catch (error) {
      console.error('Firebase async initialization failed:', error);
    }
  }

  return { app, db, auth };
}

export { db, auth, initializeFirebase };
export default app;

