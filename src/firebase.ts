import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { 
  getFirestore,
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  writeBatch,
  deleteDoc
} from "firebase/firestore";
import { ScholarMetadata, LogEntry, Holiday } from "./types";

const firebaseConfig = {
  projectId: "clean-lantern-9mvz5",
  appId: "1:278647187348:web:10b8099e346e2c2ca49181",
  apiKey: "AIzaSyCAhvvMeZ3atCJWe6ktQd-E-rSj19a97d0",
  authDomain: "clean-lantern-9mvz5.firebaseapp.com",
  firestoreDatabaseId: "ai-studio-d0f9e541-c51b-48b1-bddb-43472800bc4a",
  storageBucket: "clean-lantern-9mvz5.firebasestorage.app",
  messagingSenderId: "278647187348"
};

// Initialize Firebase App
const app = initializeApp(firebaseConfig);

// Initialize Firebase Auth
export const auth = getAuth(app);

// Initialize Firestore targeting the specific custom database ID
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

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
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid || null,
      email: auth.currentUser?.email || null,
      emailVerified: auth.currentUser?.emailVerified || null,
      isAnonymous: auth.currentUser?.isAnonymous || null,
      tenantId: auth.currentUser?.tenantId || null,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

/**
 * Saves the ScholarMetadata to Firestore
 */
export async function saveScholarToCloud(userId: string, scholar: ScholarMetadata) {
  const path = `users/${userId}/settings/scholar`;
  try {
    const settingsDocRef = doc(db, path);
    await setDoc(settingsDocRef, scholar);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

/**
 * Loads ScholarMetadata from Firestore
 */
export async function loadScholarFromCloud(userId: string): Promise<ScholarMetadata | null> {
  const path = `users/${userId}/settings/scholar`;
  try {
    const settingsDocRef = doc(db, path);
    const snapshot = await getDoc(settingsDocRef);
    if (snapshot.exists()) {
      return snapshot.data() as ScholarMetadata;
    }
    return null;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
    return null;
  }
}

/**
 * Saves custom holidays to Firestore
 */
export async function saveHolidaysToCloud(userId: string, holidays: Holiday[]) {
  const path = `users/${userId}/settings/holidays`;
  try {
    const settingsDocRef = doc(db, path);
    await setDoc(settingsDocRef, { holidays });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

/**
 * Loads custom holidays from Firestore
 */
export async function loadHolidaysFromCloud(userId: string): Promise<Holiday[] | null> {
  const path = `users/${userId}/settings/holidays`;
  try {
    const settingsDocRef = doc(db, path);
    const snapshot = await getDoc(settingsDocRef);
    if (snapshot.exists()) {
      return snapshot.data().holidays as Holiday[];
    }
    return null;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
    return null;
  }
}

/**
 * Syncs the entire entries list to cloud.
 * Batch operation for performance.
 */
export async function saveEntriesToCloud(userId: string, entries: LogEntry[]) {
  const entriesPath = `users/${userId}/entries`;
  try {
    const entriesCollectionRef = collection(db, entriesPath);
    
    // We need to overwrite the cloud entries with our current local entries
    // To avoid orphaned documents, we first get all existing document IDs on the cloud
    const snapshot = await getDocs(entriesCollectionRef);
    const cloudDocIds = snapshot.docs.map(d => d.id);
    
    // Start batches
    const batch = writeBatch(db);
    
    // 1. Delete all existing cloud entries
    cloudDocIds.forEach(id => {
      const entryDocRef = doc(db, `users/${userId}/entries/${id}`);
      batch.delete(entryDocRef);
    });
    
    // 2. Set all new cloud entries
    entries.forEach(entry => {
      const entryDocRef = doc(db, `users/${userId}/entries/${entry.id}`);
      batch.set(entryDocRef, entry);
    });
    
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, entriesPath);
  }
}

/**
 * Loads entries from Firestore
 */
export async function loadEntriesFromCloud(userId: string): Promise<LogEntry[]> {
  const entriesPath = `users/${userId}/entries`;
  try {
    const entriesCollectionRef = collection(db, entriesPath);
    const snapshot = await getDocs(entriesCollectionRef);
    const loadedEntries: LogEntry[] = [];
    snapshot.forEach(docSnap => {
      loadedEntries.push(docSnap.data() as LogEntry);
    });
    return loadedEntries;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, entriesPath);
    return [];
  }
}
