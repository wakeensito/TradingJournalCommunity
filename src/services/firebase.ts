/**
 * Firebase Configuration
 * Initialize Firebase services
 */

// Initialize Firebase only if config is available
let app: any = undefined;
let db: any = undefined;

async function initializeFirebase() {
  if (app !== undefined) {
    return { app, db }; // Already initialized
  }

  try {
    const { initializeApp } = await import('firebase/app');
    const { getFirestore } = await import('firebase/firestore');

    // Firebase configuration
    const firebaseConfig = {
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'trading-journal-9209f',
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
      appId: import.meta.env.VITE_FIREBASE_APP_ID || ''
    };

    if (firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.apiKey !== '') {
      app = initializeApp(firebaseConfig);
      db = getFirestore(app);
    } else {
      app = null;
      db = null;
    }
  } catch (error) {
    console.warn('Firebase initialization failed, using localStorage:', error);
    app = null;
    db = null;
  }

  return { app, db };
}

// Initialize on module load
initializeFirebase().catch(() => {
  // Silent fail - will use localStorage
});

export { db, initializeFirebase };
export default app;

