import { z } from 'zod';

export const allowedAssetMimeTypeSchema = z.enum([
  'image/png',
  'image/jpeg',
  'image/webp',
  'text/plain',
]);
export type AllowedAssetMimeType = z.infer<typeof allowedAssetMimeTypeSchema>;

export const assetOwnerKindSchema = z.enum(['parent', 'child']);
export type AssetOwnerKind = z.infer<typeof assetOwnerKindSchema>;

export const MAX_ASSET_SIZE_BYTES = 5 * 1024 * 1024; // 5 MiB

export const storedAssetSchema = z.object({
  id: z.string(),
  ownerKind: assetOwnerKindSchema,
  ownerId: z.string(),
  key: z.string(),
  mimeType: allowedAssetMimeTypeSchema,
  sizeBytes: z.number().int().min(0).max(MAX_ASSET_SIZE_BYTES),
  createdAt: z.string().datetime(),
});
export type StoredAssetDto = z.infer<typeof storedAssetSchema>;

export const createUploadUrlRequestSchema = z.object({
  ownerKind: assetOwnerKindSchema,
  ownerId: z.string(),
  mimeType: allowedAssetMimeTypeSchema,
  sizeBytes: z.number().int().min(1).max(MAX_ASSET_SIZE_BYTES),
  fileName: z.string().min(1).max(200),
});
export type CreateUploadUrlRequest = z.infer<typeof createUploadUrlRequestSchema>;

export const createUploadUrlResponseSchema = z.object({
  assetId: z.string(),
  uploadUrl: z.string().url(),
  method: z.enum(['PUT', 'POST']),
  headers: z.record(z.string(), z.string()).optional(),
  expiresAt: z.string().datetime(),
});
export type CreateUploadUrlResponse = z.infer<typeof createUploadUrlResponseSchema>;

export const completeUploadRequestSchema = z.object({
  assetId: z.string(),
});
export type CompleteUploadRequest = z.infer<typeof completeUploadRequestSchema>;

export const completeUploadResponseSchema = z.object({
  asset: storedAssetSchema,
});
export type CompleteUploadResponse = z.infer<typeof completeUploadResponseSchema>;

export const readUrlResponseSchema = z.object({
  readUrl: z.string().url(),
  expiresAt: z.string().datetime(),
});
export type ReadUrlResponse = z.infer<typeof readUrlResponseSchema>;
