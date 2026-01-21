/**
 * Trade and Account Storage Service
 * Handles Firebase storage for trades and accounts (Firebase only, no localStorage)
 */

import { Trade, Account } from '../types/trade';


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
 * Load trades from Firebase (Firebase only)
 */
export async function loadTrades(): Promise<Trade[]> {
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
    throw new Error('No authenticated user, cannot load trades from Firebase');
  }

  const userId = auth.currentUser.uid;
  const collectionPath = `users/${userId}/trades`;
  console.log(`[loadTrades] Loading trades from Firebase path: ${collectionPath}`);
  console.log(`[loadTrades] User ID: ${userId}`);
  
  const tradesRef = collection(db, 'users', userId, 'trades');
  
  // Try with orderBy first, fallback to simple query if it fails (e.g., missing index)
  let snapshot;
  try {
    const q = query(tradesRef, orderBy('date', 'desc'));
    snapshot = await getDocs(q);
  } catch (error: any) {
    console.warn('[loadTrades] orderBy query failed, trying without orderBy:', error.message);
    // Fallback to simple query without orderBy
    snapshot = await getDocs(tradesRef);
  }

  const loadedTrades = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  } as Trade));
  
  // Sort manually if orderBy failed
  loadedTrades.sort((a, b) => {
    const dateA = new Date(a.date).getTime();
    const dateB = new Date(b.date).getTime();
    return dateB - dateA; // Descending
  });
  
  console.log(`[loadTrades] Loaded ${loadedTrades.length} trade(s) from Firebase path: ${collectionPath}`);
  return loadedTrades;
}

/**
 * Save trades to Firebase (Firebase only)
 */
export async function saveTrades(trades: Trade[]): Promise<void> {
  if (!(await isFirebaseAvailable())) {
    throw new Error('Firebase is not available');
  }

  const { collection, doc, setDoc, deleteDoc, getDocs } = await import('firebase/firestore');
  const { initializeFirebase } = await import('./firebase');
  const { db, auth } = await initializeFirebase();

  if (!db || !auth) {
    throw new Error('Firebase not initialized');
  }
  
  if (!auth.currentUser) {
    throw new Error('No authenticated user, cannot save trades to Firebase');
  }

  const userId = auth.currentUser.uid;
  const collectionPath = `users/${userId}/trades`;
  
  console.log(`[saveTrades] Saving ${trades.length} trade(s) to Firebase path: ${collectionPath}`);
  console.log(`[saveTrades] User ID: ${userId}`);

  // IMPORTANT: Don't delete trades that aren't in the list - only add/update
  // Deletions should only happen through explicit delete functions (deleteTrade, deleteTrades)
  // This prevents race conditions where an empty or stale array would delete all trades
  
  // Get existing trades from Firebase to check what needs updating
  const tradesRef = collection(db, 'users', userId, 'trades');
  const snapshot = await getDocs(tradesRef);
  const existingIds = new Set(snapshot.docs.map(d => d.id));
  const newIds = new Set(trades.map(t => t.id));

  console.log(`[saveTrades] Found ${snapshot.docs.length} existing trades in Firebase`);
  console.log(`[saveTrades] Will add/update ${trades.length} trade(s)`);
  
  // NOTE: We're NOT deleting trades here - only adding/updating
  // This prevents accidental deletion when state is temporarily empty or stale

  // Helper function to remove undefined and null values from an object (Firestore doesn't allow undefined)
  const removeUndefined = (obj: any): any => {
    // Handle primitives
    if (obj === null || obj === undefined) {
      return null; // Return null instead of undefined, but we'll filter it out
    }
    if (typeof obj !== 'object') {
      return obj;
    }
    
    // Handle Date objects
    if (obj instanceof Date) {
      return obj.toISOString();
    }
    
    // Handle arrays
    if (Array.isArray(obj)) {
      return obj.map(removeUndefined).filter(item => item !== undefined);
    }
    
    // Handle objects
    const cleaned: any = {};
    for (const [key, value] of Object.entries(obj)) {
      // Skip undefined values completely
      if (value !== undefined) {
        const cleanedValue = removeUndefined(value);
        // Only add if the cleaned value is not undefined
        if (cleanedValue !== undefined) {
          cleaned[key] = cleanedValue;
        }
      }
    }
    return cleaned;
  };

  // Add or update trades
  let savedCount = 0;
  let errorCount = 0;
  for (const trade of trades) {
    const tradeRef = doc(db, 'users', userId, 'trades', trade.id);
    try {
      // First, create a clean copy of the trade without undefined values
      const tradeCopy: any = {};
      for (const [key, value] of Object.entries(trade)) {
        if (value !== undefined) {
          tradeCopy[key] = value;
        }
      }
      
      // Add updatedAt timestamp
      tradeCopy.updatedAt = new Date().toISOString();
      
      // Remove any remaining undefined values recursively
      const cleanedTrade = removeUndefined(tradeCopy);
      
      // Double-check: ensure no undefined values exist
      const finalTrade: any = {};
      for (const [key, value] of Object.entries(cleanedTrade)) {
        if (value !== undefined) {
          finalTrade[key] = value;
        }
      }
      
      await setDoc(tradeRef, finalTrade, { merge: true });
      savedCount++;
      console.log(`[saveTrades] ✅ Successfully saved trade ${trade.id} (${trade.symbol || 'N/A'}) to Firebase`);
      console.log(`[saveTrades] Document path: users/${userId}/trades/${trade.id}`);
      console.log(`[saveTrades] Document data keys:`, Object.keys(finalTrade).join(', '));
    } catch (error: any) {
      errorCount++;
      console.error(`[saveTrades] Error saving trade ${trade.id}:`, error);
      console.error(`[saveTrades] Error code: ${error.code}, message: ${error.message}`);
      console.error(`[saveTrades] Trade data:`, JSON.stringify(trade, null, 2));
      // Don't throw immediately - try to save the rest
      if (errorCount === 1) {
        // Only throw on first error to see what's wrong
        throw error;
      }
    }
  }
  
  if (errorCount === 0) {
    console.log(`[saveTrades] Successfully saved ${savedCount} trade(s) to Firebase`);
  } else {
    console.error(`[saveTrades] Saved ${savedCount} trades, but ${errorCount} failed`);
  }
}

/**
 * Load accounts from Firebase (Firebase only)
 */
export async function loadAccounts(): Promise<Account[]> {
  if (!(await isFirebaseAvailable())) {
    throw new Error('Firebase is not available');
  }

  const { collection, getDocs } = await import('firebase/firestore');
  const { initializeFirebase } = await import('./firebase');
  const { db, auth } = await initializeFirebase();

  if (!db || !auth) {
    throw new Error('Firebase not initialized');
  }
  
  if (!auth.currentUser) {
    throw new Error('No authenticated user, cannot load accounts from Firebase');
  }

  const userId = auth.currentUser.uid;
  const accountsRef = collection(db, `users/${userId}/accounts`);
  const snapshot = await getDocs(accountsRef);

  const accounts = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  } as Account));

  // Firebase only - return empty array if no accounts (don't create default)
  // Default account should only be created in UI if user explicitly wants it
  console.log(`[loadAccounts] Loaded ${accounts.length} account(s) from Firebase`);
  return accounts;
}

/**
 * Save accounts to Firebase (Firebase only)
 */
export async function saveAccounts(accounts: Account[]): Promise<void> {
  if (!(await isFirebaseAvailable())) {
    throw new Error('Firebase is not available');
  }

  const { collection, doc, setDoc, deleteDoc, getDocs } = await import('firebase/firestore');
  const { initializeFirebase } = await import('./firebase');
  const { db, auth } = await initializeFirebase();

  if (!db || !auth) {
    throw new Error('Firebase not initialized');
  }
  
  if (!auth.currentUser) {
    throw new Error('No authenticated user, cannot save accounts to Firebase');
  }

  const userId = auth.currentUser.uid;
  const collectionPath = `users/${userId}/accounts`;
  
  console.log(`[saveAccounts] Saving ${accounts.length} account(s) to Firebase path: ${collectionPath}`);
  console.log(`[saveAccounts] User ID: ${userId}`);

  // IMPORTANT: Don't delete accounts that aren't in the list - only add/update
  // Deletions should only happen through explicit delete functions
  // This prevents race conditions where an empty or stale array would delete all accounts
  
  // Get existing accounts from Firebase to check what needs updating
  const accountsRef = collection(db, 'users', userId, 'accounts');
  const snapshot = await getDocs(accountsRef);
  const existingIds = new Set(snapshot.docs.map(d => d.id));
  const newIds = new Set(accounts.map(a => a.id));

  console.log(`[saveAccounts] Found ${snapshot.docs.length} existing accounts in Firebase`);
  console.log(`[saveAccounts] Will add/update ${accounts.length} account(s)`);
  
  // NOTE: We're NOT deleting accounts here - only adding/updating
  // This prevents accidental deletion when state is temporarily empty or stale

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

  // Add or update accounts
  let savedCount = 0;
  let errorCount = 0;
  for (const account of accounts) {
    const accountRef = doc(db, `users/${userId}/accounts`, account.id);
    try {
      // First, create a clean copy of the account without undefined values
      const accountCopy: any = {};
      for (const [key, value] of Object.entries(account)) {
        if (value !== undefined) {
          accountCopy[key] = value;
        }
      }
      
      // Add updatedAt timestamp
      accountCopy.updatedAt = new Date().toISOString();
      
      // Remove any remaining undefined values recursively
      const cleanedAccount = removeUndefined(accountCopy);
      
      // Double-check: ensure no undefined values exist
      const finalAccount: any = {};
      for (const [key, value] of Object.entries(cleanedAccount)) {
        if (value !== undefined) {
          finalAccount[key] = value;
        }
      }
      
      await setDoc(accountRef, finalAccount, { merge: true });
      savedCount++;
      console.log(`[saveAccounts] ✅ Successfully saved account ${account.id} (${account.name}) to Firebase`);
    } catch (error: any) {
      errorCount++;
      console.error(`[saveAccounts] Error saving account ${account.id}:`, error);
      console.error(`[saveAccounts] Error code: ${error.code}, message: ${error.message}`);
      console.error(`[saveAccounts] Account data:`, JSON.stringify(account, null, 2));
      throw error;
    }
  }
  
  if (errorCount === 0) {
    console.log(`[saveAccounts] ✅ Successfully saved ${savedCount} account(s) to Firebase`);
  } else {
    console.error(`[saveAccounts] ❌ Saved ${savedCount} accounts, but ${errorCount} failed`);
  }
}

/**
 * Load selected account ID from Firebase (Firebase only)
 */
export async function loadSelectedAccountId(): Promise<string | null> {
  if (!(await isFirebaseAvailable())) {
    throw new Error('Firebase is not available');
  }

  const { doc, getDoc } = await import('firebase/firestore');
  const { initializeFirebase } = await import('./firebase');
  const { db, auth } = await initializeFirebase();

  if (!db || !auth || !auth.currentUser) {
    throw new Error('No authenticated user, cannot load selected account ID from Firebase');
  }

  const userId = auth.currentUser.uid;
  const userPrefsRef = doc(db, `users/${userId}/preferences/selectedAccountId`);
  const docSnap = await getDoc(userPrefsRef);

  if (docSnap.exists()) {
    return docSnap.data().value || null;
  }

  return null;
}

/**
 * Save selected account ID to Firebase (Firebase only)
 */
export async function saveSelectedAccountId(accountId: string | null): Promise<void> {
  if (!(await isFirebaseAvailable())) {
    throw new Error('Firebase is not available');
  }

  const { doc, setDoc } = await import('firebase/firestore');
  const { initializeFirebase } = await import('./firebase');
  const { db, auth } = await initializeFirebase();

  if (!db || !auth || !auth.currentUser) {
    throw new Error('No authenticated user, cannot save selected account ID to Firebase');
  }

  const userId = auth.currentUser.uid;
  const userPrefsRef = doc(db, `users/${userId}/preferences/selectedAccountId`);
  
  console.log(`[saveSelectedAccountId] Saving selected account ID: ${accountId} for user ${userId}`);
  
  // Remove undefined values (Firestore doesn't allow undefined)
  const cleanedPrefs: any = {
    updatedAt: new Date().toISOString()
  };
  if (accountId !== null && accountId !== undefined && accountId !== '') {
    cleanedPrefs.value = accountId;
  } else {
    // Explicitly set to null if accountId is null/undefined/empty
    cleanedPrefs.value = null;
  }
  
  await setDoc(userPrefsRef, cleanedPrefs, { merge: true });
  console.log(`[saveSelectedAccountId] ✅ Successfully saved selected account ID (${accountId || 'null'}) to Firebase`);
}

function getDefaultAccount(): Account[] {
  return [{
    id: '1',
    name: 'TakeProfit Trader - Main',
    propFirm: 'TakeProfit Trader',
    accountType: 'eval' as const,
    accountSize: 50000,
    startDate: new Date().toISOString().split('T')[0],
    status: 'active' as const,
    notes: 'Default prop firm account'
  }];
}

