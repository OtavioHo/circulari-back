import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { STORAGE_SERVICE } from './storage.interface';
import { S3StorageService } from './s3-storage.service';
import { R2StorageService } from './r2-storage.service';
import { MinioStorageService } from './minio-storage.service';

@Module({
  providers: [
    {
      provide: STORAGE_SERVICE,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const provider = config.getOrThrow<string>('STORAGE_PROVIDER');
        switch (provider) {
          case 's3':
            return new S3StorageService(config);
          case 'r2':
            return new R2StorageService(config);
          case 'minio':
            return new MinioStorageService(config);
          default:
            throw new Error(`Unknown STORAGE_PROVIDER "${provider}". Valid values: s3, r2, minio`);
        }
      },
    },
  ],
  exports: [STORAGE_SERVICE],
})
export class StorageModule {}
