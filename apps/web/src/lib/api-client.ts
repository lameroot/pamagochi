import type { ZodType } from 'zod';
import { webEnv } from './env.js';

export interface ApiClientError {
  code: string;
  message: string;
  requestId?: string;
  status: number;
}

export class ApiError extends Error implements ApiClientError {
  code: string;
  requestId?: string;
  status: number;

  constructor(input: ApiClientError) {
    super(input.message);
    this.name = 'ApiError';
    this.code = input.code;
    this.requestId = input.requestId;
    this.status = input.status;
  }
}

export interface GetAccessTokenFn {
  (): Promise<string | null>;
}

export interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  timeoutMs?: number;
  signal?: AbortSignal;
}

const DEFAULT_TIMEOUT_MS = 10_000;

export class ApiClient {
  constructor(
    private readonly baseUrl: string,
    private readonly getAccessToken: GetAccessTokenFn,
  ) {}

  async request<T>(path: string, schema: ZodType<T>, options: ApiRequestOptions = {}): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);

    if (options.signal) {
      options.signal.addEventListener('abort', () => controller.abort(), { once: true });
    }

    const token = await this.getAccessToken();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        method: options.method ?? 'GET',
        headers,
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new ApiError({ code: 'TIMEOUT', message: 'Request timed out', status: 0 });
      }
      throw new ApiError({ code: 'NETWORK_ERROR', message: 'Network request failed', status: 0 });
    } finally {
      clearTimeout(timeout);
    }

    const requestId = response.headers.get('x-request-id') ?? undefined;
    const json: unknown = await response.json().catch(() => undefined);

    if (!response.ok) {
      const errorBody = json as
        { error?: { code?: string; message?: string; requestId?: string } } | undefined;
      throw new ApiError({
        code: errorBody?.error?.code ?? 'UNKNOWN_ERROR',
        message: errorBody?.error?.message ?? `Request failed with status ${response.status}`,
        requestId: errorBody?.error?.requestId ?? requestId,
        status: response.status,
      });
    }

    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      throw new ApiError({
        code: 'INVALID_RESPONSE_SHAPE',
        message: `Response did not match the expected schema: ${parsed.error.message}`,
        requestId,
        status: response.status,
      });
    }

    return parsed.data;
  }
}

export function createApiClient(getAccessToken: GetAccessTokenFn): ApiClient {
  return new ApiClient(webEnv.apiUrl, getAccessToken);
}
