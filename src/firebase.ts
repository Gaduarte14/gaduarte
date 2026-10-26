import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  type User as FirebaseUser,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  getDocFromServer,
  setDoc,
  onSnapshot,
  collection,
} from 'firebase/firestore';

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyAU9eSZY-2RBqXtOsRw4ulZbzHYXlA3D1s',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'table-top-98973.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'table-top-98973',
  storageBucket:
    import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'table-top-98973.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '1018198607221',
  appId:
    import.meta.env.VITE_FIREBASE_APP_ID ||
    '1:1018198607221:web:5b6034339bc4d3e3627f3c',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || 'G-H37JKBQRDT',
};

export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): FirestoreErrorInfo {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData.map((provider) => ({
          providerId: provider.providerId,
          displayName: provider.displayName,
          email: provider.email,
          photoUrl: provider.photoURL,
        })) || [],
    },
    operationType,
    path,
  };
  console.warn('Firestore Operation Notice:', JSON.stringify(errInfo));
  return errInfo;
}

/**
 * Recursively strips `undefined` properties from objects/arrays before saving to Firestore,
 * since Firestore rejects `undefined` values in document payloads.
 */
export function sanitizeForFirestore<T>(value: T): T {
  if (value === undefined) {
    return null as unknown as T;
  }
  if (value === null || typeof value !== 'object') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeForFirestore(item)) as unknown as T;
  }
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (v !== undefined) {
      result[k] = sanitizeForFirestore(v);
    }
  }
  return result as T;
}

export async function signInWithGoogle(): Promise<FirebaseUser | null> {
  const credential = await signInWithPopup(auth, googleProvider);
  return credential.user;
}

export async function logoutFirebase(): Promise<void> {
  await signOut(auth);
}

// Validate connection to Firestore non-destructively on boot
async function verifyFirestoreConnection() {
  try {
    await getDocFromServer(doc(db, '_connection_check', 'ping'));
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes('the client is offline')
    ) {
      console.warn('Firestore client is currently offline or unreachable.');
    }
  }
}
if (typeof window !== 'undefined') {
  verifyFirestoreConnection();
}

export {
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  collection,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type FirebaseUser,
};
