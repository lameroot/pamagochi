export interface AuthClient {
  readonly mode: 'local' | 'cloud';
  getAccessToken(): Promise<string | null>;
  isDevMode(): boolean;
}
