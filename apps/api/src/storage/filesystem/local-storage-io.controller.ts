import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { BadRequestException, Controller, Get, Put, Query, Req, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { allowedAssetMimeTypeSchema, MAX_ASSET_SIZE_BYTES } from '@pamagochi/contracts';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { FilesystemObjectStorage } from './filesystem-object-storage.js';
import { verifyUrlSignature } from './signed-url.js';

/**
 * Unauthenticated (by JWT) but HMAC-signature-gated read/write endpoints
 * for the local filesystem storage backend — the local equivalent of an S3
 * presigned URL. Only registered when STORAGE_PROVIDER=filesystem.
 * Served content is always forced to download (never inline-rendered) to
 * remove any risk of an uploaded file being executed by a browser.
 */
@ApiExcludeController()
@Controller('api/assets')
export class LocalStorageIoController {
  constructor(private readonly storage: FilesystemObjectStorage) {}

  @Get('local-read')
  async localRead(
    @Query('key') key: string | undefined,
    @Query('exp') exp: string | undefined,
    @Query('sig') sig: string | undefined,
    @Res({ passthrough: false }) reply: FastifyReply,
  ): Promise<void> {
    if (!key || !exp || !sig) throw new BadRequestException('Missing signed URL parameters');

    const expiresAtEpochSeconds = Number(exp);
    const valid = verifyUrlSignature(
      this.storage.signingSecret,
      { key, method: 'GET', expiresAtEpochSeconds },
      sig,
    );
    if (!valid) {
      reply.status(403).send({
        error: {
          code: 'FORBIDDEN',
          message: 'Invalid or expired signature',
          requestId: reply.request.id,
        },
      });
      return;
    }

    const absolutePath = this.storage.resolveAbsolutePath(key);
    try {
      await stat(absolutePath);
    } catch {
      reply.status(404).send({
        error: {
          code: 'ASSET_NOT_FOUND',
          message: 'Object not found',
          requestId: reply.request.id,
        },
      });
      return;
    }

    reply.header('Content-Type', 'application/octet-stream');
    reply.header('Content-Disposition', 'attachment');
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.send(createReadStream(absolutePath));
  }

  @Put('local-upload')
  async localUpload(
    @Query('key') key: string | undefined,
    @Query('exp') exp: string | undefined,
    @Query('sig') sig: string | undefined,
    @Query('mime') mime: string | undefined,
    @Req() request: FastifyRequest,
    @Res({ passthrough: false }) reply: FastifyReply,
  ): Promise<void> {
    if (!key || !exp || !sig || !mime)
      throw new BadRequestException('Missing signed URL parameters');

    const mimeResult = allowedAssetMimeTypeSchema.safeParse(mime);
    if (!mimeResult.success) throw new BadRequestException('Unsupported MIME type');

    const expiresAtEpochSeconds = Number(exp);
    const valid = verifyUrlSignature(
      this.storage.signingSecret,
      { key, method: 'PUT', expiresAtEpochSeconds },
      sig,
    );
    if (!valid) {
      reply.status(403).send({
        error: {
          code: 'FORBIDDEN',
          message: 'Invalid or expired signature',
          requestId: reply.request.id,
        },
      });
      return;
    }

    const body = request.body;
    if (!Buffer.isBuffer(body)) {
      throw new BadRequestException('Expected a binary request body');
    }
    if (body.byteLength > MAX_ASSET_SIZE_BYTES) {
      reply.status(413).send({
        error: {
          code: 'PAYLOAD_TOO_LARGE',
          message: 'File exceeds maximum allowed size',
          requestId: reply.request.id,
        },
      });
      return;
    }

    await this.storage.putObject({ key, body, mimeType: mimeResult.data });
    reply.status(200).send({ ok: true });
  }
}
