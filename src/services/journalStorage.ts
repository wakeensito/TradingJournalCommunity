/**
 * Journal Entry Storage Service
 * Handles Firebase storage for journal entries (Firebase only, no localStorage)
 */

import { JournalEntry } from '../types/journal';


// Check if Firebase is available
async function isFirebaseAvailable(): Promise<boolean> {
  try {
    const { initializeFirebase } = await import('./firebase');
    const { db } = await initializeFirebase();
    return db !== undefined && db !== null;
  } catch {
    return false;
  }
}

/**
 * Load journal entries from Firebase (Firebase only)
 */
export async function loadJournalEntries(): Promise<JournalEntry[]> {
  if (!(await isFirebaseAvailable())) {
    throw new Error('Firebase is not available');
  }

  const { collection, getDocs, query, orderBy } = await import('firebase/firestore');
  const { initializeFirebase } = await import('./firebase');
  const { db, auth } = await initializeFirebase();

  if (!db || !auth) {
    throw new Error('Firebase not initialized');
  }
  
  if (!auth.currentUser) {
    throw new Error('No authenticated user, cannot load from Firebase');
  }

  const userId = auth.currentUser.uid;
  const entriesRef = collection(db, `users/${userId}/journal`);
  
  // Try to query with orderBy, but fallback to simple query if index doesn't exist
  let snapshot;
  try {
    const q = query(entriesRef, orderBy('date', 'desc'));
    snapshot = await getDocs(q);
  } catch (error: any) {
    // If orderBy fails (likely missing index), just get all docs and sort in memory
    console.warn('orderBy query failed, fetching all and sorting in memory:', error);
    snapshot = await getDocs(entriesRef);
  }

  const entries = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  } as JournalEntry));
  
  // Sort by date if we couldn't use orderBy
  entries.sort((a, b) => {
    const dateA = a.date ? new Date(a.date).getTime() : 0;
    const dateB = b.date ? new Date(b.date).getTime() : 0;
    return dateB - dateA; // Descending order
  });
  
  return entries;
}

/**
 * Save journal entries to Firebase (Firebase only)
 */
export async function saveJournalEntries(entries: JournalEntry[]): Promise<void> {
  if (!(await isFirebaseAvailable())) {
    throw new Error('Firebase is not available');
  }

  const { collection, doc, deleteDoc, getDocs, writeBatch } = await import('firebase/firestore');
  const { initializeFirebase } = await import('./firebase');
  const { db, auth } = await initializeFirebase();

  if (!db || !auth) {
    throw new Error('Firebase not initialized');
  }
  
  if (!auth.currentUser) {
    throw new Error('No authenticated user, cannot save to Firebase');
  }

  const userId = auth.currentUser.uid;

  // Get existing entries from Firebase
  const entriesRef = collection(db, `users/${userId}/journal`);
  const snapshot = await getDocs(entriesRef);
  const existingIds = new Set(snapshot.docs.map(d => d.id));
  const newIds = new Set(entries.map(e => e.id));

  // Use batch writes for better performance (max 500 operations per batch)
  const BATCH_SIZE = 500;
  let batch = writeBatch(db);
  let operationCount = 0;

  // Delete entries that are no longer in the list
  for (const docSnap of snapshot.docs) {
    if (!newIds.has(docSnap.id)) {
      batch.delete(doc(db, `users/${userId}/journal`, docSnap.id));
      operationCount++;
      
      // Commit batch if we hit the limit
      if (operationCount >= BATCH_SIZE) {
        await batch.commit();
        batch = writeBatch(db);
        operationCount = 0;
      }
    }
  }

  // Helper function to remove undefined values from an object
  const removeUndefined = (obj: any): any => {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }
    if (Array.isArray(obj)) {
      return obj.map(removeUndefined);
    }
    const cleaned: any = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        cleaned[key] = removeUndefined(value);
      }
    }
    return cleaned;
  };

  // Add or update entries in batches
  for (const entry of entries) {
    const entryRef = doc(db, `users/${userId}/journal`, entry.id);
    const cleanedEntry = removeUndefined({
      ...entry,
      updatedAt: new Date().toISOString()
    });
    batch.set(entryRef, cleanedEntry, { merge: true });
    operationCount++;
    
    // Commit batch if we hit the limit
    if (operationCount >= BATCH_SIZE) {
      await batch.commit();
      batch = writeBatch(db);
      operationCount = 0;
    }
  }

  // Commit any remaining operations
  if (operationCount > 0) {
    await batch.commit();
  }
}

/**
 * Add a new journal entry
 */
export async function addJournalEntry(entry: JournalEntry): Promise<void> {
  const entries = await loadJournalEntries();
  entries.push(entry);
  await saveJournalEntries(entries);
}

/**
 * Delete a journal entry (Firebase only)
 */
export async function deleteJournalEntry(entryId: string): Promise<void> {
  if (!(await isFirebaseAvailable())) {
    throw new Error('Firebase is not available');
  }

  const { doc, deleteDoc } = await import('firebase/firestore');
  const { initializeFirebase } = await import('./firebase');
  const { db, auth } = await initializeFirebase();

  if (!db || !auth) {
    throw new Error('Firebase not initialized');
  }
  
  if (!auth.currentUser) {
    throw new Error('No authenticated user, cannot delete from Firebase');
  }

  await deleteDoc(doc(db, `users/${auth.currentUser.uid}/journal`, entryId));
}

