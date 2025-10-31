
import { initializeApp, getApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let app: FirebaseApp | undefined;
let auth: Auth | undefined;
let db: Firestore | undefined;
let storage: FirebaseStorage | undefined;

// Initialize Firebase lazily only in browser
if (typeof window !== 'undefined') {
  // Validate config before initializing
  const isConfigValid = Object.values(firebaseConfig).every(
    value => value && value !== 'undefined' && !value.includes('your-')
  );

  if (!isConfigValid) {
    console.error('❌ Firebase configuration is invalid or missing. Please check your .env file.');
    console.error('Missing/Invalid values:',
      Object.entries(firebaseConfig)
        .filter(([_, v]) => !v || v === 'undefined' || v.includes('your-'))
        .map(([k]) => k)
    );
  } else {
    try {
      if (!getApps().length) {
        app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        db = getFirestore(app);
        storage = getStorage(app);
        console.log('✅ Firebase initialized successfully');
      } else {
        app = getApp();
        auth = getAuth(app);
        db = getFirestore(app);
        storage = getStorage(app);
      }
    } catch (error) {
      console.error('❌ Firebase initialization error:', error);
    }
  }
}

export { app, auth, db, storage };
