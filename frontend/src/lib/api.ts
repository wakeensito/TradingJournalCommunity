// Typed client for every route in the spec's API table. Same origin, Bearer access token.

import { getAccessToken, AuthError } from './auth';
import { getConfig } from './config';
import type { Account, Bootstrap, DayNote, Settings, Trade } from './types';

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

type Method = 'GET' | 'PUT' | 'POST' | 'DELETE';

async function send<T>(method: Method, path: string, body?: unknown, auth = true): Promise<T> {
  const url = `${getConfig().apiBase}${path}`;
  const attempt = async (force: boolean): Promise<Response> => {
    const headers: Record<string, string> = {};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (auth) {
      try {
        headers.Authorization = `Bearer ${await getAccessToken(force)}`;
      } catch (e) {
        if (e instanceof AuthError && e.code === 'Network') throw new ApiError(0, e.message);
        throw new ApiError(401, e instanceof Error ? e.message : 'Signed out.');
      }
    }
    try {
      return await fetch(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    } catch {
      throw new ApiError(0, 'You’re offline. Check your connection and retry.');
    }
  };

  let res = await attempt(false);
  if (res.status === 401 && auth) res = await attempt(true);

  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }
  if (!res.ok) {
    const obj = (data && typeof data === 'object' ? data : {}) as { error?: unknown; message?: unknown };
    const msg =
      (typeof obj.error === 'string' && obj.error) ||
      (typeof obj.message === 'string' && obj.message) ||
      `Request failed (${res.status}).`;
    throw new ApiError(res.status, msg);
  }
  return data as T;
}

const enc = encodeURIComponent;

export const api = {
  health: () => send<{ ok: boolean }>('GET', '/health', undefined, false),
  bootstrap: () => send<Bootstrap>('GET', '/bootstrap'),

  putTrade: (t: Trade) => send<Trade>('PUT', `/trades/${enc(t.id)}`, t),
  deleteTrade: (id: string) => send<{ deleted: boolean }>('DELETE', `/trades/${enc(id)}`),
  batchTrades: (trades: Trade[]) => send<{ written: number }>('POST', '/trades/batch', { trades }),
  combineTrades: (sourceIds: string[], merged: Trade) =>
    send<Trade>('POST', '/trades/combine', { sourceIds, merged }),

  putDay: (d: DayNote) => send<DayNote>('PUT', `/days/${enc(d.date)}`, d),

  putAccount: (a: Account) => send<Account>('PUT', `/accounts/${enc(a.id)}`, a),
  deleteAccount: (id: string) => send<{ deleted: boolean }>('DELETE', `/accounts/${enc(id)}`),

  putSettings: (s: Settings) => send<Settings>('PUT', '/settings', s),

  photoUploadUrl: (tradeId: string, contentType: string, size: number) =>
    send<{ key: string; url: string }>('POST', '/photos/upload-url', { tradeId, contentType, size }),
  photoViewUrls: (keys: string[]) => send<{ urls: Record<string, string> }>('POST', '/photos/view-urls', { keys }),

  coach: (from: string, to: string, question?: string) =>
    send<{ text: string }>('POST', '/ai/coach', question ? { from, to, question } : { from, to }),
};

/** PUT a file to a presigned S3 URL. */
export async function putToPresigned(url: string, file: Blob, contentType: string): Promise<void> {
  let res: Response;
  try {
    res = await fetch(url, { method: 'PUT', headers: { 'Content-Type': contentType }, body: file });
  } catch {
    throw new ApiError(0, 'Upload failed — you may be offline.');
  }
  if (!res.ok) throw new ApiError(res.status, `Upload failed (${res.status}).`);
}
