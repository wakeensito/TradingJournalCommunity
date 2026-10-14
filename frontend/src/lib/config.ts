// Runtime config written by the deploy to /config.json. Fetched once at boot.

export interface AppConfig {
  region: string;
  userPoolId: string;
  clientId: string;
  apiBase: string;
}

let cached: AppConfig | null = null;
let inflight: Promise<AppConfig> | null = null;

export function loadConfig(): Promise<AppConfig> {
  if (cached) return Promise.resolve(cached);
  if (inflight) return inflight;
  inflight = (async () => {
    const res = await fetch('/config.json', { cache: 'no-store' });
    if (!res.ok) throw new Error(`Couldn't load app config (${res.status}).`);
    const raw = (await res.json()) as Partial<AppConfig>;
    if (!raw.region || !raw.userPoolId || !raw.clientId) {
      throw new Error('App config is missing region, userPoolId or clientId.');
    }
    cached = {
      region: raw.region,
      userPoolId: raw.userPoolId,
      clientId: raw.clientId,
      apiBase: (raw.apiBase || '/api').replace(/\/$/, ''),
    };
    return cached;
  })().finally(() => {
    inflight = null;
  });
  return inflight;
}

export function getConfig(): AppConfig {
  if (!cached) throw new Error('Config not loaded yet.');
  return cached;
}
