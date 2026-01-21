import {
    GoogleAuthProvider,
    signInWithPopup,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    User,
    AuthError,
    sendPasswordResetEmail
} from 'firebase/auth';
import { auth, initializeFirebase } from './firebase';

// Auth error codes
export enum AuthErrorCode {
    USER_NOT_FOUND = 'auth/user-not-found',
    WRONG_PASSWORD = 'auth/wrong-password',
    EMAIL_ALREADY_IN_USE = 'auth/email-already-in-use',
    INVALID_EMAIL = 'auth/invalid-email',
    WEAK_PASSWORD = 'auth/weak-password',
    NETWORK_ERROR = 'auth/network-request-failed',
    TOO_MANY_REQUESTS = 'auth/too-many-requests'
}

// Get user-friendly error message
export function getAuthErrorMessage(error: AuthError): string {
    switch (error.code) {
        case AuthErrorCode.USER_NOT_FOUND:
            return 'No account found with this email address.';
        case AuthErrorCode.WRONG_PASSWORD:
            return 'Incorrect password. Please try again.';
        case AuthErrorCode.EMAIL_ALREADY_IN_USE:
            return 'An account with this email already exists.';
        case AuthErrorCode.INVALID_EMAIL:
            return 'Invalid email address.';
        case AuthErrorCode.WEAK_PASSWORD:
            return 'Password should be at least 6 characters.';
        case AuthErrorCode.NETWORK_ERROR:
            return 'Network error. Please check your connection.';
        case AuthErrorCode.TOO_MANY_REQUESTS:
            return 'Too many failed attempts. Please try again later.';
        default:
            return error.message || 'An error occurred during authentication.';
    }
}

// Ensure Firebase is initialized
async function ensureAuth(): Promise<Auth> {
    // If auth is already available, return it
    if (auth) {
        return auth;
    }
    
    // Try to initialize
    const { auth: initializedAuth } = await initializeFirebase();
    if (!initializedAuth) {
        throw new Error('Firebase Auth not initialized. Please check your Firebase configuration. Make sure VITE_FIREBASE_API_KEY and other Firebase environment variables are set.');
    }
    return initializedAuth;
}

export async function signInWithGoogle(): Promise<User | null> {
    const authInstance = await ensureAuth();
    const provider = new GoogleAuthProvider();
    try {
        const result = await signInWithPopup(authInstance, provider);
        return result.user;
    } catch (error) {
        console.error('Error signing in with Google', error);
        throw error;
    }
}

export async function signInWithEmail(email: string, password: string): Promise<User | null> {
    const authInstance = await ensureAuth();
    try {
        const result = await signInWithEmailAndPassword(authInstance, email, password);
        return result.user;
    } catch (error: any) {
        console.error('Error signing in with email', error);
        // Re-throw with user-friendly message
        if (error.code) {
            const friendlyError = new Error(getAuthErrorMessage(error));
            (friendlyError as any).code = error.code;
            throw friendlyError;
        }
        throw error;
    }
}

export async function signUpWithEmail(email: string, password: string): Promise<User | null> {
    const authInstance = await ensureAuth();
    try {
        const result = await createUserWithEmailAndPassword(authInstance, email, password);
        return result.user;
    } catch (error: any) {
        console.error('Error signing up with email', error);
        // Re-throw with user-friendly message
        if (error.code) {
            const friendlyError = new Error(getAuthErrorMessage(error));
            (friendlyError as any).code = error.code;
            throw friendlyError;
        }
        throw error;
    }
}

export async function resetPassword(email: string): Promise<void> {
    const authInstance = await ensureAuth();
    try {
        await sendPasswordResetEmail(authInstance, email);
    } catch (error: any) {
        console.error('Error sending password reset email', error);
        if (error.code) {
            const friendlyError = new Error(getAuthErrorMessage(error));
            (friendlyError as any).code = error.code;
            throw friendlyError;
        }
        throw error;
    }
}

export async function logout(): Promise<void> {
    const authInstance = await ensureAuth();
    try {
        await signOut(authInstance);
    } catch (error) {
        console.error('Error signing out', error);
        throw error;
    }
}

export function subscribeToAuthChanges(callback: (user: User | null) => void): () => void {
    let unsubscribe: (() => void) | null = null;
    let isSubscribed = false;

    // If auth is already available, subscribe immediately
    if (auth) {
        unsubscribe = onAuthStateChanged(auth, callback);
        isSubscribed = true;
        return () => {
            if (unsubscribe) {
                unsubscribe();
            }
        };
    }

    // Otherwise, try to initialize and subscribe
    initializeFirebase().then(({ auth: initializedAuth }) => {
        if (initializedAuth && !isSubscribed) {
            unsubscribe = onAuthStateChanged(initializedAuth, callback);
            isSubscribed = true;
        } else if (!initializedAuth) {
            // If auth is not available, call callback with null
            callback(null);
        }
    }).catch((error) => {
        console.error('Failed to initialize Firebase auth', error);
        callback(null);
    });

    // Return unsubscribe function
    return () => {
        if (unsubscribe) {
            unsubscribe();
        }
    };
}
