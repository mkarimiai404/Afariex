import { Platform } from 'react-native';

type JsonValue = Record<string, any> | any[];

const PROD_BASE_URL = 'https://afariex.ir/API/';
const TIMEOUT_MS = 12000;
const MAX_ATTEMPTS = 1;

const normalizeBase = (url: string) => `${url.replace(/\/+$/, '')}/`;

const getBaseCandidates = () => {
  const envBase = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
  if (envBase) {
    return [normalizeBase(envBase)];
  }
  return [normalizeBase(PROD_BASE_URL)];
};

const withTimeout = async (url: string, init?: RequestInit) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const mergedHeaders = {
      Accept: 'application/json',
      ...(init?.headers || {}),
    };
    return await fetch(url, { ...init, headers: mergedHeaders, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
};

const getErrorDetails = (error: unknown) => {
  if (error instanceof Error) {
    return {
      message: error.message,
      cause: error.cause,
      name: error.name,
    };
  }

  return {
    message: String(error),
    cause: undefined,
    name: typeof error,
  };
};

const toNetworkError = (endpoint: string, finalUrl: string, error: unknown) => {
  const details = getErrorDetails(error);
  const wrappedError = new Error(`Request failed for ${endpoint} at ${finalUrl}: ${details.message}`);
  (wrappedError as Error & { cause?: unknown }).cause = details.cause ?? error;
  return wrappedError;
};

export const getApiBaseUrl = () => getBaseCandidates()[0];

export const apiUrl = (endpoint: string) =>
  `${getApiBaseUrl()}${endpoint.replace(/^\/+/, '')}`;

export const fetchJson = async <T = JsonValue>(
  endpoint: string,
  init?: RequestInit
): Promise<T> => {
  const normalizedEndpoint = endpoint.replace(/^\/+/, '');
  const candidates = getBaseCandidates();
  const urls = candidates.map((base) => `${base}${normalizedEndpoint}`);

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    for (const url of urls) {
      try {
        const method = (init?.method || 'GET').toUpperCase();
        console.log(`[API] request attempt=${attempt} method=${method} url=${url}`);
        const response = await withTimeout(url, init);
        const text = (await response.text()).trim();
        console.log(`[API] response status=${response.status} method=${method} url=${url}`);
        console.log(`[API] response preview (${normalizedEndpoint}): ${text.slice(0, 300)}`);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${text.slice(0, 180) || 'Empty response'}`);
        }

        if (text.startsWith('<')) {
          throw new Error('HTML response received instead of JSON.');
        }

        try {
          return JSON.parse(text) as T;
        } catch {
          throw new Error(`Invalid JSON response: ${text.slice(0, 180) || 'Empty response'}`);
        }
      } catch (error) {
        const details = getErrorDetails(error);
        const method = (init?.method || 'GET').toUpperCase();
        console.log('[API] full error object', error);
        console.log('[API] error.message', details.message);
        console.log('[API] error.name', details.name);
        console.log('[API] error.cause', details.cause);
        console.log('[API] error details', {
          endpoint: normalizedEndpoint,
          url,
          method,
          requestHeaders: init?.headers || null,
          hasBody: Boolean(init?.body),
          message: details.message,
          cause: details.cause,
          name: details.name,
          timeoutMs: TIMEOUT_MS,
        });
        const maybeAxiosError = error as {
          response?: unknown;
          request?: unknown;
          config?: unknown;
        };
        console.log('[API] error.response', maybeAxiosError?.response ?? null);
        console.log('[API] error.request', maybeAxiosError?.request ?? null);
        console.log('[API] error.config', maybeAxiosError?.config ?? null);
        console.warn(`[API] failed endpoint=${normalizedEndpoint} url=${url}`, error);
        lastError = toNetworkError(normalizedEndpoint, url, error);
      }
    }
  }

  throw lastError || new Error(`Request failed for ${normalizedEndpoint}`);
};
