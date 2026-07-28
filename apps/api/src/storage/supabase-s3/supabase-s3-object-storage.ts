import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable } from '@nestjs/common';
import { AppConfigService } from '../../config/app-config.service.js';
import { assertSafeObjectKey, buildObjectKey } from '../domain/object-key.js';
import type {
  CreateUploadUrlInput,
  ObjectStorage,
  PutObjectInput,
  StoredObject,
  UploadTarget,
} from '../domain/object-storage.js';

const READ_URL_TTL_SECONDS = 5 * 60;
const UPLOAD_URL_TTL_SECONDS = 5 * 60;

/**
 * Server-only S3-compatible client for the private Supabase Storage bucket.
 * The S3 access key/secret never leave the backend — the frontend only ever
 * receives short-lived signed URLs produced here.
 */
@Injectable()
export class SupabaseS3ObjectStorage implements ObjectStorage {
  private clientAndBucket: { client: S3Client; bucket: string } | undefined;

  constructor(private readonly config: AppConfigService) {}

  /**
   * Lazily constructed so that this provider can safely exist in the DI
   * graph even when APP_PROFILE=local (where Supabase credentials are
   * intentionally absent) — it only throws if a caller actually tries to
   * use Supabase storage without configuring it.
   */
  private getClient(): { client: S3Client; bucket: string } {
    if (!this.clientAndBucket) {
      const { s3Endpoint, s3Region, s3AccessKey, s3SecretKey, storageBucket } =
        this.config.supabase;
      if (!s3Endpoint || !s3Region || !s3AccessKey || !s3SecretKey || !storageBucket) {
        throw new Error('Supabase S3 storage is not fully configured');
      }
      this.clientAndBucket = {
        bucket: storageBucket,
        client: new S3Client({
          endpoint: s3Endpoint,
          region: s3Region,
          forcePathStyle: true,
          credentials: { accessKeyId: s3AccessKey, secretAccessKey: s3SecretKey },
        }),
      };
    }
    return this.clientAndBucket;
  }

  async putObject(input: PutObjectInput): Promise<StoredObject> {
    assertSafeObjectKey(input.key);
    const { client, bucket } = this.getClient();
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: input.key,
        Body: input.body,
        ContentType: input.mimeType,
      }),
    );
    return { key: input.key, sizeBytes: input.body.byteLength };
  }

  async deleteObject(key: string): Promise<void> {
    assertSafeObjectKey(key);
    const { client, bucket } = this.getClient();
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  }

  async createReadUrl(key: string, expiresInSeconds: number): Promise<string> {
    assertSafeObjectKey(key);
    const { client, bucket } = this.getClient();
    return getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: key }), {
      expiresIn: Math.min(expiresInSeconds, READ_URL_TTL_SECONDS),
    });
  }

  async createUploadUrl(input: CreateUploadUrlInput): Promise<UploadTarget> {
    const key = buildObjectKey(input.ownerKind, input.ownerId, input.fileName);
    const { client, bucket } = this.getClient();
    const uploadUrl = await getSignedUrl(
      client,
      new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: input.mimeType }),
      { expiresIn: UPLOAD_URL_TTL_SECONDS },
    );
    return {
      key,
      uploadUrl,
      method: 'PUT',
      headers: { 'Content-Type': input.mimeType },
      expiresAt: new Date(Date.now() + UPLOAD_URL_TTL_SECONDS * 1000),
    };
  }
}
