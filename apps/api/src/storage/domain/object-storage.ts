import type { AllowedAssetMimeType, AssetOwnerKind } from '@pamagochi/contracts';

export interface PutObjectInput {
  key: string;
  body: Buffer;
  mimeType: AllowedAssetMimeType;
}

export interface StoredObject {
  key: string;
  sizeBytes: number;
}

export interface CreateUploadUrlInput {
  ownerKind: AssetOwnerKind;
  ownerId: string;
  mimeType: AllowedAssetMimeType;
  sizeBytes: number;
  fileName: string;
}

export interface UploadTarget {
  key: string;
  uploadUrl: string;
  method: 'PUT' | 'POST';
  headers?: Record<string, string>;
  expiresAt: Date;
}

export const OBJECT_STORAGE = Symbol('OBJECT_STORAGE');

export interface ObjectStorage {
  putObject(input: PutObjectInput): Promise<StoredObject>;
  deleteObject(key: string): Promise<void>;
  createReadUrl(key: string, expiresInSeconds: number): Promise<string>;
  createUploadUrl(input: CreateUploadUrlInput): Promise<UploadTarget>;
}
