import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { S3StorageService } from './s3-storage.service';
import { R2StorageService } from './r2-storage.service';
import { MinioStorageService } from './minio-storage.service';

jest.mock('@aws-sdk/client-s3', () => {
  const mockSend = jest.fn().mockResolvedValue({});
  return {
    S3Client: jest.fn().mockImplementation(() => ({ send: mockSend })),
    PutObjectCommand: jest.fn().mockImplementation((input) => input),
    __mockSend: mockSend,
  };
});

function mockConfig(values: Record<string, string>): ConfigService {
  return {
    getOrThrow: (key: string) => {
      if (!(key in values)) throw new Error(`Missing config: ${key}`);
      return values[key];
    },
    get: (key: string, fallback?: string) => values[key] ?? fallback,
  } as unknown as ConfigService;
}

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { __mockSend: mockSend } = require('@aws-sdk/client-s3') as {
  __mockSend: jest.Mock;
};

describe('S3StorageService', () => {
  const baseConfig = {
    STORAGE_BUCKET: 'my-bucket',
    STORAGE_REGION: 'us-east-1',
    STORAGE_ACCESS_KEY: 'access',
    STORAGE_SECRET_KEY: 'secret',
  };

  beforeEach(() => mockSend.mockClear());

  it('calls PutObjectCommand with correct params', async () => {
    const service = new S3StorageService(mockConfig(baseConfig));
    const buffer = Buffer.from('image-data');

    await service.upload(buffer, 'items/uuid.jpg', 'image/jpeg');

    expect(PutObjectCommand).toHaveBeenCalledWith({
      Bucket: 'my-bucket',
      Key: 'items/uuid.jpg',
      Body: buffer,
      ContentType: 'image/jpeg',
    });
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it('returns default public URL when STORAGE_PUBLIC_URL is not set', async () => {
    const service = new S3StorageService(mockConfig(baseConfig));
    const url = await service.upload(Buffer.from(''), 'items/uuid.jpg', 'image/jpeg');
    expect(url).toBe('https://my-bucket.s3.us-east-1.amazonaws.com/items/uuid.jpg');
  });

  it('returns custom public URL when STORAGE_PUBLIC_URL is set', async () => {
    const service = new S3StorageService(
      mockConfig({ ...baseConfig, STORAGE_PUBLIC_URL: 'https://cdn.example.com' }),
    );
    const url = await service.upload(Buffer.from(''), 'items/uuid.jpg', 'image/jpeg');
    expect(url).toBe('https://cdn.example.com/items/uuid.jpg');
  });

  it('throws on missing required config', () => {
    expect(() => new S3StorageService(mockConfig({}))).toThrow();
  });
});

describe('R2StorageService', () => {
  const baseConfig = {
    STORAGE_BUCKET: 'my-bucket',
    STORAGE_ACCESS_KEY: 'access',
    STORAGE_SECRET_KEY: 'secret',
    STORAGE_ENDPOINT: 'https://accountid.r2.cloudflarestorage.com',
  };

  beforeEach(() => mockSend.mockClear());

  it('calls PutObjectCommand with correct params', async () => {
    const service = new R2StorageService(mockConfig(baseConfig));
    const buffer = Buffer.from('image-data');

    await service.upload(buffer, 'items/uuid.png', 'image/png');

    expect(PutObjectCommand).toHaveBeenCalledWith({
      Bucket: 'my-bucket',
      Key: 'items/uuid.png',
      Body: buffer,
      ContentType: 'image/png',
    });
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it('returns default public URL derived from endpoint', async () => {
    const service = new R2StorageService(mockConfig(baseConfig));
    const url = await service.upload(Buffer.from(''), 'items/uuid.png', 'image/png');
    expect(url).toBe('https://accountid.r2.cloudflarestorage.com/my-bucket/items/uuid.png');
  });

  it('returns custom public URL when STORAGE_PUBLIC_URL is set', async () => {
    const service = new R2StorageService(
      mockConfig({ ...baseConfig, STORAGE_PUBLIC_URL: 'https://pub.r2.example.com' }),
    );
    const url = await service.upload(Buffer.from(''), 'items/uuid.png', 'image/png');
    expect(url).toBe('https://pub.r2.example.com/items/uuid.png');
  });

  it('throws when STORAGE_ENDPOINT is missing', () => {
    const { STORAGE_ENDPOINT: _endpoint, ...rest } = baseConfig;
    void _endpoint;
    expect(() => new R2StorageService(mockConfig(rest))).toThrow();
  });
});

describe('MinioStorageService', () => {
  const baseConfig = {
    STORAGE_BUCKET: 'my-bucket',
    STORAGE_ACCESS_KEY: 'minioaccess',
    STORAGE_SECRET_KEY: 'miniosecret',
    STORAGE_ENDPOINT: 'http://localhost:9000',
  };

  beforeEach(() => mockSend.mockClear());

  it('calls PutObjectCommand with correct params', async () => {
    const service = new MinioStorageService(mockConfig(baseConfig));
    const buffer = Buffer.from('image-data');

    await service.upload(buffer, 'items/uuid.webp', 'image/webp');

    expect(PutObjectCommand).toHaveBeenCalledWith({
      Bucket: 'my-bucket',
      Key: 'items/uuid.webp',
      Body: buffer,
      ContentType: 'image/webp',
    });
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it('creates S3Client with forcePathStyle true', () => {
    new MinioStorageService(mockConfig(baseConfig));
    expect(S3Client).toHaveBeenCalledWith(expect.objectContaining({ forcePathStyle: true }));
  });

  it('returns default public URL derived from endpoint', async () => {
    const service = new MinioStorageService(mockConfig(baseConfig));
    const url = await service.upload(Buffer.from(''), 'items/uuid.webp', 'image/webp');
    expect(url).toBe('http://localhost:9000/my-bucket/items/uuid.webp');
  });

  it('throws when STORAGE_ENDPOINT is missing', () => {
    const { STORAGE_ENDPOINT: _endpoint, ...rest } = baseConfig;
    void _endpoint;
    expect(() => new MinioStorageService(mockConfig(rest))).toThrow();
  });
});
