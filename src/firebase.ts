import { initializeApp, getApps, getApp, deleteApp, FirebaseApp } from 'firebase/app';
import { getFirestore, initializeFirestore, Firestore } from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';

export interface FirebaseConfigType {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
  firestoreDatabaseId?: string;
}

export const defaultFirebaseConfig: FirebaseConfigType = {
  apiKey: "AIzaSyBkVyJGHQmlKf-jjL6Q-MefI92pSTEOL0E",
  authDomain: "project-2f92977a-3f04-4243-aee.firebaseapp.com",
  projectId: "project-2f92977a-3f04-4243-aee",
  storageBucket: "project-2f92977a-3f04-4243-aee.firebasestorage.app",
  messagingSenderId: "442102724532",
  appId: "1:442102724532:web:a590cab1e8d12835cfa4e1",
  measurementId: "",
  firestoreDatabaseId: "lisanslamaaaa",
};

const STORAGE_KEY = 'custom_firebase_config_v1';

export function getStoredFirebaseConfig(): FirebaseConfigType {
  if (typeof window !== 'undefined') {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.projectId && parsed.apiKey) {
          return { ...defaultFirebaseConfig, ...parsed };
        }
      }
    } catch {
      // fallback
    }
  }
  return defaultFirebaseConfig;
}

export let firebaseConfig: FirebaseConfigType = getStoredFirebaseConfig();
export let app: FirebaseApp;
export let db: Firestore;
export let auth: Auth;

export function initFirebase(config: FirebaseConfigType) {
  firebaseConfig = { ...config };
  
  const existingApps = getApps();
  if (existingApps.length > 0) {
    for (const exApp of existingApps) {
      try {
        deleteApp(exApp).catch(() => {});
      } catch {
        // ignore
      }
    }
  }

  try {
    app = initializeApp(firebaseConfig);
  } catch {
    app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  }

  try {
    const dbId = firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)'
      ? firebaseConfig.firestoreDatabaseId
      : undefined;

    db = dbId ? getFirestore(app, dbId) : getFirestore(app);
  } catch (err) {
    try {
      db = getFirestore(app);
    } catch {
      // ignore
    }
  }

  try {
    auth = getAuth(app);
  } catch {
    // ignore
  }
}

// Initial boot
initFirebase(firebaseConfig);

export async function setRuntimeFirebaseConfig(newConfig: Partial<FirebaseConfigType>): Promise<FirebaseConfigType> {
  const merged: FirebaseConfigType = {
    ...firebaseConfig,
    ...newConfig,
  };

  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  }
  initFirebase(merged);

  // Sync to server backend
  try {
    await fetch('/api/firebase-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(merged),
    });
  } catch {
    // ignore
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('firebase-config-updated', { detail: merged }));
  }
  return merged;
}

export async function resetRuntimeFirebaseConfig(): Promise<FirebaseConfigType> {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(STORAGE_KEY);
  }
  initFirebase(defaultFirebaseConfig);

  try {
    await fetch('/api/firebase-config/reset', {
      method: 'POST',
    });
  } catch {
    // ignore
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('firebase-config-updated', { detail: defaultFirebaseConfig }));
  }
  return defaultFirebaseConfig;
}




