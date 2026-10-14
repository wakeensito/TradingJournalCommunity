// Cognito User Pool auth over plain fetch (no SDK). The refresh token lives in localStorage so each
// device signs in once; the access token lives only in memory.

import { getConfig } from './config';

const STORAGE_KEY = 'tj.auth';
const REFRESH_MARGIN_MS = 2 * 60 * 1000;

interface Stored {
  refreshToken: string;
  email: string;
}

interface AuthResult {
  AccessToken: string;
  ExpiresIn: number;
  RefreshToken?: string;
  IdToken?: string;
}

interface CognitoResponse {
  AuthenticationResult?: AuthResult;
  ChallengeName?: string;
  Session?: string;
  ChallengeParameters?: Record<string, string>;
}

export class AuthError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

export type SignInResult =
  | { kind: 'signed-in' }
  | { kind: 'new-password'; session: string; username: string };

type Listener = (signedIn: boolean) => void;

let access: { token: string; expiresAt: number } | null = null;
let refreshing: Promise<string> | null = null;
const listeners = new Set<Listener>();

// ---------- storage ----------

function readStored(): Stored | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<Stored>;
    return v.refreshToken && v.email ? { refreshToken: v.refreshToken, email: v.email } : null;
  } catch {
    return null;
  }
}

function writeStored(v: Stored | null) {
  try {
    if (v) localStorage.setItem(STORAGE_KEY, JSON.stringify(v));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* private mode: stay signed in for this tab only */
  }
}

let memoryStored: Stored | null = null;
function stored(): Stored | null {
  return readStored() ?? memoryStored;
}
function setStored(v: Stored | null) {
  memoryStored = v;
  writeStored(v);
}

// ---------- transport ----------

const HUMAN: Record<string, string> = {
  NotAuthorizedException: 'Wrong email or password.',
  UserNotFoundException: 'Wrong email or password.',
  PasswordResetRequiredException: 'You need to reset your password. Use "Forgot password".',
  UserNotConfirmedException: 'This account isn’t confirmed yet.',
  InvalidPasswordException: 'That password doesn’t meet the rules: at least 8 characters with upper, lower and a number.',
  InvalidParameterException: 'Check the fields and try again.',
  CodeMismatchException: 'That code isn’t right. Check the email and try again.',
  ExpiredCodeException: 'That code expired. Request a new one.',
  LimitExceededException: 'Too many attempts. Wait a few minutes and try again.',
  TooManyRequestsException: 'Too many attempts. Wait a minute and try again.',
  TooManyFailedAttemptsException: 'Too many attempts. Wait a few minutes and try again.',
  CodeDeliveryFailureException: 'We couldn’t send the code. Try again shortly.',
};

async function cognito<T>(op: string, body: Record<string, unknown>): Promise<T> {
  const { region } = getConfig();
  let res: Response;
  try {
    res = await fetch(`https://cognito-idp.${region}.amazonaws.com/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-amz-json-1.1',
        'X-Amz-Target': `AWSCognitoIdentityProviderService.${op}`,
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new AuthError('Network', 'You’re offline or the sign-in service is unreachable.');
  }
  const data = (await res.json().catch(() => ({}))) as { __type?: string; message?: string } & T;
  if (!res.ok) {
    const code = (data.__type || 'Unknown').split('#').pop() || 'Unknown';
    let msg = HUMAN[code] ?? data.message ?? 'Something went wrong. Try again.';
    if (code === 'NotAuthorizedException' && /refresh token/i.test(data.message ?? '')) {
      msg = 'Your session expired. Sign in again.';
    }
    throw new AuthError(code, msg);
  }
  return data;
}

function acceptResult(r: AuthResult, email: string, existingRefresh?: string) {
  access = { token: r.AccessToken, expiresAt: Date.now() + r.ExpiresIn * 1000 };
  const refreshToken = r.RefreshToken ?? existingRefresh;
  if (refreshToken) setStored({ refreshToken, email });
  emit(true);
}

let lastEmitted: boolean | null = null;
function emit(v: boolean) {
  if (lastEmitted === v) return;
  lastEmitted = v;
  listeners.forEach((l) => l(v));
}

// ---------- public API ----------

export function onAuthChange(l: Listener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** True when this device has a refresh token (may still need a network refresh). */
export function hasSession(): boolean {
  return stored() !== null;
}

export function currentEmail(): string | null {
  return stored()?.email ?? null;
}

export async function signIn(email: string, password: string): Promise<SignInResult> {
  const username = email.trim().toLowerCase();
  const r = await cognito<CognitoResponse>('InitiateAuth', {
    AuthFlow: 'USER_PASSWORD_AUTH',
    ClientId: getConfig().clientId,
    AuthParameters: { USERNAME: username, PASSWORD: password },
  });
  if (r.AuthenticationResult) {
    acceptResult(r.AuthenticationResult, username);
    return { kind: 'signed-in' };
  }
  if (r.ChallengeName === 'NEW_PASSWORD_REQUIRED' && r.Session) {
    return {
      kind: 'new-password',
      session: r.Session,
      username: r.ChallengeParameters?.USER_ID_FOR_SRP ?? username,
    };
  }
  throw new AuthError('UnsupportedChallenge', `Sign-in needs a step this app doesn’t support (${r.ChallengeName}).`);
}

export async function completeNewPassword(
  email: string,
  username: string,
  session: string,
  newPassword: string,
): Promise<void> {
  const r = await cognito<CognitoResponse>('RespondToAuthChallenge', {
    ChallengeName: 'NEW_PASSWORD_REQUIRED',
    ClientId: getConfig().clientId,
    Session: session,
    ChallengeResponses: { USERNAME: username, NEW_PASSWORD: newPassword },
  });
  if (!r.AuthenticationResult) throw new AuthError('Unknown', 'Couldn’t finish setting your password. Try again.');
  acceptResult(r.AuthenticationResult, email.trim().toLowerCase());
}

export async function forgotPassword(email: string): Promise<void> {
  await cognito('ForgotPassword', { ClientId: getConfig().clientId, Username: email.trim().toLowerCase() });
}

export async function confirmForgotPassword(email: string, code: string, newPassword: string): Promise<void> {
  await cognito('ConfirmForgotPassword', {
    ClientId: getConfig().clientId,
    Username: email.trim().toLowerCase(),
    ConfirmationCode: code.trim(),
    Password: newPassword,
  });
}

/** Valid access token, refreshing (single-flight) when under 2 minutes remain. */
export async function getAccessToken(force = false): Promise<string> {
  if (!force && access && access.expiresAt - Date.now() > REFRESH_MARGIN_MS) return access.token;
  if (refreshing) return refreshing;
  const s = stored();
  if (!s) throw new AuthError('SignedOut', 'You’re signed out.');
  refreshing = (async () => {
    try {
      const r = await cognito<CognitoResponse>('InitiateAuth', {
        AuthFlow: 'REFRESH_TOKEN_AUTH',
        ClientId: getConfig().clientId,
        AuthParameters: { REFRESH_TOKEN: s.refreshToken },
      });
      if (!r.AuthenticationResult) throw new AuthError('Unknown', 'Your session expired. Sign in again.');
      acceptResult(r.AuthenticationResult, s.email, s.refreshToken);
      return r.AuthenticationResult.AccessToken;
    } catch (e) {
      // Only a definitive rejection signs the device out; a network blip keeps the session.
      if (e instanceof AuthError && e.code === 'NotAuthorizedException') {
        access = null;
        setStored(null);
        emit(false);
      }
      throw e;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

/** Decoded JWT payload (no verification: display only — the API enforces every permission server-side). */
export function decodeJwt(token: string): Record<string, unknown> | null {
  const part = token.split('.')[1];
  if (!part) return null;
  try {
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(part.length / 4) * 4, '=');
    const json = decodeURIComponent(
      [...atob(b64)].map((c) => `%${c.charCodeAt(0).toString(16).padStart(2, '0')}`).join(''),
    );
    const v = JSON.parse(json) as unknown;
    return v && typeof v === 'object' ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Cognito groups from the current access token (the same token the API checks). */
export function currentGroups(): string[] {
  const g = access ? decodeJwt(access.token)?.['cognito:groups'] : undefined;
  return Array.isArray(g) ? g.filter((x): x is string => typeof x === 'string') : [];
}

export function isAdmin(): boolean {
  return currentGroups().includes('admin');
}

/** Ensure a fresh access token, then report admin membership (false when signed out or offline). */
export async function loadIsAdmin(): Promise<boolean> {
  try {
    await getAccessToken();
  } catch {
    return false;
  }
  return isAdmin();
}

export async function changePassword(oldPassword: string, newPassword: string): Promise<void> {
  const token = await getAccessToken();
  try {
    await cognito('ChangePassword', { PreviousPassword: oldPassword, ProposedPassword: newPassword, AccessToken: token });
  } catch (e) {
    if (e instanceof AuthError && e.code === 'NotAuthorizedException') {
      throw new AuthError(e.code, 'Your current password isn’t right.');
    }
    throw e;
  }
}

/** Revoke every refresh token for this user (all devices), then sign this device out. */
export async function globalSignOut(): Promise<void> {
  const token = await getAccessToken();
  await cognito('GlobalSignOut', { AccessToken: token });
  access = null;
  setStored(null);
  emit(false);
}

export async function signOut(): Promise<void> {
  const s = stored();
  access = null;
  setStored(null);
  emit(false);
  if (s) {
    try {
      await cognito('RevokeToken', { ClientId: getConfig().clientId, Token: s.refreshToken });
    } catch {
      /* best effort; local state is already cleared */
    }
  }
}
