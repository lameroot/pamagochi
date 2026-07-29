import { type DynamicModule, Module } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service.js';
import { ConfigModule } from '../config/config.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { AssetsController } from './assets.controller.js';
import { OBJECT_STORAGE } from './domain/object-storage.js';
import { FilesystemObjectStorage } from './filesystem/filesystem-object-storage.js';
import { LocalStorageIoController } from './filesystem/local-storage-io.controller.js';
import { SupabaseS3ObjectStorage } from './supabase-s3/supabase-s3-object-storage.js';

function isFilesystemStorageCandidate(): boolean {
  return process.env.STORAGE_PROVIDER === 'filesystem';
}

@Module({})
export class StorageModule {
  static forRoot(): DynamicModule {
    const registerLocalIo = isFilesystemStorageCandidate();

    return {
      module: StorageModule,
      imports: [ConfigModule, DatabaseModule, AuthModule],
      controllers: registerLocalIo
        ? [AssetsController, LocalStorageIoController]
        : [AssetsController],
      providers: [
        FilesystemObjectStorage,
        SupabaseS3ObjectStorage,
        {
          provide: OBJECT_STORAGE,
          inject: [AppConfigService, FilesystemObjectStorage, SupabaseS3ObjectStorage],
          useFactory: (
            config: AppConfigService,
            filesystem: FilesystemObjectStorage,
            supabaseS3: SupabaseS3ObjectStorage,
          ) => (config.storageProvider === 'filesystem' ? filesystem : supabaseS3),
        },
      ],
      exports: [OBJECT_STORAGE],
    };
  }
}
