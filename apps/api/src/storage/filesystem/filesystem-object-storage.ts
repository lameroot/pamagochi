import { mkdir, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import { Injectable } from '@nestjs/common';
import { MAX_ASSET_SIZE_BYTES } from '@pamagochi/contracts';
import { AppConfigService } from '../../config/app-config.service.js';
import { assertSafeObjectKey, buildObjectKey } from '../domain/object-key.js';
import type {
  CreateUploadUrlInput,
  ObjectStorage,
  PutObjectInput,
  StoredObject,
  UploadTarget,
} from '../domain/object-storage.js';
import { signUrlParams } from './signed-url.js';

const READ_URL_TTL_SECONDS = 5 * 60;
const UPLOAD_URL_TTL_SECONDS = 5 * 60;

@Injectable()
export class FilesystemObjectStorage implements ObjectStorage {
  constructor(private readonly config: AppConfigService) {}

  private get root(): string {
    return resolve(process.cwd(), this.config.localStoragePath);
  }

  get signingSecret(): string {
    return this.config.localStorageSigningSecret;
  }

  /** Resolves key to an absolute path, refusing to escape the storage root. */
  private resolveWithinRoot(key: string): string {
    assertSafeObjectKey(key);
    const root = this.root;
    const absolute = resolve(root, key);
    if (absolute !== root && !absolute.startsWith(root + sep)) {
      throw new Error('Resolved path escapes the storage root');
    }
    return absolute;
  }

  async putObject(input: PutObjectInput): Promise<StoredObject> {
    if (input.body.byteLength > MAX_ASSET_SIZE_BYTES) {
      throw new Error('Object exceeds maximum allowed size');
    }
    const absolutePath = this.resolveWithinRoot(input.key);
    await mkdir(dirname(absolutePath), { recursive: true });
    // Files are written without execute permission and never served as
    // executable content; reads go through a dedicated JSON/binary route.
    await writeFile(absolutePath, input.body, { mode: 0o600 });
    return { key: input.key, sizeBytes: input.body.byteLength };
  }

  async deleteObject(key: string): Promise<void> {
    const absolutePath = this.resolveWithinRoot(key);
    await rm(absolutePath, { force: true });
  }

  async createReadUrl(key: string, expiresInSeconds: number): Promise<string> {
    assertSafeObjectKey(key);
    const ttl = Math.min(expiresInSeconds, READ_URL_TTL_SECONDS);
    const expiresAtEpochSeconds = Math.floor(Date.now() / 1000) + ttl;
    const signature = signUrlParams(this.config.localStorageSigningSecret, {
      key,
      method: 'GET',
      expiresAtEpochSeconds,
    });
    const query = new URLSearchParams({
      key,
      exp: String(expiresAtEpochSeconds),
      sig: signature,
    });
    return `/api/assets/local-read?${query.toString()}`;
  }

  async createUploadUrl(input: CreateUploadUrlInput): Promise<UploadTarget> {
    const key = buildObjectKey(input.ownerKind, input.ownerId, input.fileName);
    const expiresAtEpochSeconds = Math.floor(Date.now() / 1000) + UPLOAD_URL_TTL_SECONDS;
    const signature = signUrlParams(this.config.localStorageSigningSecret, {
      key,
      method: 'PUT',
      expiresAtEpochSeconds,
    });
    const query = new URLSearchParams({
      key,
      exp: String(expiresAtEpochSeconds),
      sig: signature,
      mime: input.mimeType,
    });
    return {
      key,
      uploadUrl: `/api/assets/local-upload?${query.toString()}`,
      method: 'PUT',
      expiresAt: new Date(expiresAtEpochSeconds * 1000),
    };
  }

  /** Used by the local-read/local-upload routes to check object existence & size cheaply. */
  async statObject(key: string): Promise<{ sizeBytes: number } | null> {
    const absolutePath = this.resolveWithinRoot(key);
    try {
      const info = await stat(absolutePath);
      return { sizeBytes: info.size };
    } catch {
      return null;
    }
  }

  resolveAbsolutePath(key: string): string {
    return this.resolveWithinRoot(key);
  }

  join(...parts: string[]): string {
    return join(...parts);
  }
}
