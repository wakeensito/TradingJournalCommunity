/**
 * Journal Entry Storage Service
 * Handles Firebase and localStorage for journal entries
 */

import { JournalEntry } from '../types/journal';

const STORAGE_KEY = 'tradingJournal_entries';

// Check if Firebase is available
async function isFirebaseAvailable(): Promise<boolean> {
  try {
    const { getFirebase } = await import('./firebase');
    const { db } = await getFirebase();
    return db !== undefined && db !== null;
  } catch {
    return false;
  }
}

/**
 * Load journal entries from storage (Firebase or localStorage)
 */
export async function loadJournalEntries(): Promise<JournalEntry[]> {
  if (await isFirebaseAvailable()) {
    try {
      const { collection, getDocs, query, orderBy } = await import('firebase/firestore');
      const { getFirebase } = await import('./firebase');
      const { db } = await getFirebase();
      
      if (!db) throw new Error('Firebase not initialized');
      
      const entriesRef = collection(db, 'journalEntries');
      const q = query(entriesRef, orderBy('date', 'desc'));
      const snapshot = await getDocs(q);
      
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as JournalEntry));
    } catch (error) {
      console.error('Firebase load error, falling back to localStorage:', error);
      return loadFromLocalStorage();
    }
  }
  
  return loadFromLocalStorage();
}

/**
 * Save journal entries to storage (Firebase or localStorage)
 */
export async function saveJournalEntries(entries: JournalEntry[]): Promise<void> {
  if (await isFirebaseAvailable()) {
    try {
      const { collection, doc, setDoc, deleteDoc, getDocs } = await import('firebase/firestore');
      const { db } = await import('./firebase');
      
      if (!db) throw new Error('Firebase not initialized');
      
      // Get existing entries from Firebase
      const entriesRef = collection(db, 'journalEntries');
      const snapshot = await getDocs(entriesRef);
      const existingIds = new Set(snapshot.docs.map(d => d.id));
      const newIds = new Set(entries.map(e => e.id));
      
      // Delete entries that are no longer in the list
      for (const docSnap of snapshot.docs) {
        if (!newIds.has(docSnap.id)) {
          await deleteDoc(doc(db, 'journalEntries', docSnap.id));
        }
      }
      
      // Add or update entries
      for (const entry of entries) {
        const entryRef = doc(db, 'journalEntries', entry.id);
        await setDoc(entryRef, {
          ...entry,
          updatedAt: new Date().toISOString()
        }, { merge: true });
      }
      
      return;
    } catch (error) {
      console.error('Firebase save error, falling back to localStorage:', error);
      saveToLocalStorage(entries);
      return;
    }
  }
  
  saveToLocalStorage(entries);
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
 * Delete a journal entry
 */
export async function deleteJournalEntry(entryId: string): Promise<void> {
  if (await isFirebaseAvailable()) {
    try {
      const { doc, deleteDoc } = await import('firebase/firestore');
      const { db } = await import('./firebase');
      
      if (!db) throw new Error('Firebase not initialized');
      
      await deleteDoc(doc(db, 'journalEntries', entryId));
      return;
    } catch (error) {
      console.error('Firebase delete error, falling back to localStorage:', error);
    }
  }
  
  const entries = await loadJournalEntries();
  const filtered = entries.filter(e => e.id !== entryId);
  saveToLocalStorage(filtered);
}

// LocalStorage helpers
function loadFromLocalStorage(): JournalEntry[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch (error) {
    console.error('Failed to load from localStorage:', error);
    return [];
  }
}

function saveToLocalStorage(entries: JournalEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch (error) {
    console.error('Failed to save to localStorage:', error);
  }
}

