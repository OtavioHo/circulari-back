import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { IStorageService } from './storage.interface';

export class R2StorageService implements IStorageService {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicUrl: string;

  constructor(private readonly config: ConfigService) {
    this.bucket = config.getOrThrow<string>('STORAGE_BUCKET');
    const endpoint = config.getOrThrow<string>('STORAGE_ENDPOINT');
    const normalizedEndpoint = endpoint.replace(/\/$/, '');
    this.publicUrl = (
      config.get<string>('STORAGE_PUBLIC_URL') ?? `${normalizedEndpoint}/${this.bucket}`
    ).replace(/\/$/, '');

    this.client = new S3Client({
      region: config.get<string>('STORAGE_REGION') ?? 'auto',
      endpoint,
      credentials: {
        accessKeyId: config.getOrThrow<string>('STORAGE_ACCESS_KEY'),
        secretAccessKey: config.getOrThrow<string>('STORAGE_SECRET_KEY'),
      },
    });
  }

  async upload(buffer: Buffer, key: string, mimetype: string): Promise<string> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: mimetype,
      }),
    );
    return `${this.publicUrl}/${key.replace(/^\//, '')}`;
  }

  async getSignedUrl(key: string, expiresIn = 3600): Promise<string> {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn },
    );
  }
}
