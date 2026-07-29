import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Inject,
  NotFoundException,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  allowedAssetMimeTypeSchema,
  type AssetOwnerKind,
  type CompleteUploadResponse,
  createUploadUrlRequestSchema,
  type CreateUploadUrlResponse,
  MAX_ASSET_SIZE_BYTES,
  type ReadUrlResponse,
  type StoredAssetDto,
} from '@pamagochi/contracts';
import type { ParentAccount, StoredAsset } from '@pamagochi/database';
import { AuthGuard } from '../auth/auth.guard.js';
import { CurrentParent } from '../auth/current-parent.decorator.js';
import { PrismaService } from '../database/prisma.service.js';
import { OBJECT_STORAGE, type ObjectStorage } from './domain/object-storage.js';

const READ_URL_TTL_SECONDS = 300;

@Controller('api/assets')
@UseGuards(AuthGuard)
export class AssetsController {
  constructor(
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
    private readonly prisma: PrismaService,
  ) {}

  @Post('upload-url')
  async createUploadUrl(
    @Body() body: unknown,
    @CurrentParent() parent: ParentAccount,
  ): Promise<CreateUploadUrlResponse> {
    const parsed = createUploadUrlRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues.map((i) => i.message).join('; '));
    }

    const request = parsed.data;

    // Ownership check performed before any upload URL is minted: a parent
    // may only upload for themselves or for one of their own children.
    await this.assertOwnership(parent, request.ownerKind, request.ownerId);

    if (!allowedAssetMimeTypeSchema.safeParse(request.mimeType).success) {
      throw new BadRequestException('Unsupported MIME type');
    }
    if (request.sizeBytes > MAX_ASSET_SIZE_BYTES) {
      throw new BadRequestException('File exceeds maximum allowed size');
    }

    const target = await this.storage.createUploadUrl(request);

    const asset = await this.prisma.client.storedAsset.create({
      data: {
        ownerKind: request.ownerKind,
        ownerId: request.ownerId,
        key: target.key,
        mimeType: request.mimeType,
        sizeBytes: request.sizeBytes,
        status: 'pending',
      },
    });

    return {
      assetId: asset.id,
      uploadUrl: target.uploadUrl,
      method: target.method,
      headers: target.headers,
      expiresAt: target.expiresAt.toISOString(),
    };
  }

  @Post('complete')
  async completeUpload(
    @Body() body: unknown,
    @CurrentParent() parent: ParentAccount,
  ): Promise<CompleteUploadResponse> {
    const assetId =
      typeof body === 'object' && body !== null
        ? (body as { assetId?: unknown }).assetId
        : undefined;
    if (typeof assetId !== 'string') {
      throw new BadRequestException('assetId is required');
    }

    const asset = await this.prisma.client.storedAsset.findUnique({ where: { id: assetId } });
    if (!asset) throw new NotFoundException('Asset was not found');

    await this.assertOwnership(parent, asset.ownerKind, asset.ownerId);

    const updated = await this.prisma.client.storedAsset.update({
      where: { id: assetId },
      data: { status: 'completed' },
    });

    return { asset: this.serializeAsset(updated) };
  }

  @Get(':id/read-url')
  async readUrl(
    @Param('id') id: string,
    @CurrentParent() parent: ParentAccount,
  ): Promise<ReadUrlResponse> {
    const asset = await this.prisma.client.storedAsset.findUnique({ where: { id } });
    if (!asset) throw new NotFoundException('Asset was not found');

    await this.assertOwnership(parent, asset.ownerKind, asset.ownerId);

    const readUrl = await this.storage.createReadUrl(asset.key, READ_URL_TTL_SECONDS);
    return { readUrl, expiresAt: new Date(Date.now() + READ_URL_TTL_SECONDS * 1000).toISOString() };
  }

  @Delete(':id')
  async remove(
    @Param('id') id: string,
    @CurrentParent() parent: ParentAccount,
  ): Promise<{ deleted: true }> {
    const asset = await this.prisma.client.storedAsset.findUnique({ where: { id } });
    if (!asset) throw new NotFoundException('Asset was not found');

    await this.assertOwnership(parent, asset.ownerKind, asset.ownerId);

    await this.storage.deleteObject(asset.key);
    await this.prisma.client.storedAsset.delete({ where: { id } });

    return { deleted: true };
  }

  private serializeAsset(asset: StoredAsset): StoredAssetDto {
    return {
      id: asset.id,
      ownerKind: asset.ownerKind as AssetOwnerKind,
      ownerId: asset.ownerId,
      key: asset.key,
      mimeType: asset.mimeType as StoredAssetDto['mimeType'],
      sizeBytes: asset.sizeBytes,
      createdAt: asset.createdAt.toISOString(),
    };
  }

  private async assertOwnership(
    parent: ParentAccount,
    ownerKind: string,
    ownerId: string,
  ): Promise<void> {
    if (ownerKind === 'parent') {
      if (ownerId !== parent.id) throw new ForbiddenException('Not the owner of this resource');
      return;
    }

    const child = await this.prisma.client.childProfile.findUnique({ where: { id: ownerId } });
    if (!child || child.parentId !== parent.id) {
      throw new ForbiddenException('Not the owner of this resource');
    }
  }
}
