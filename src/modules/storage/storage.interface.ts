export const STORAGE_SERVICE = 'STORAGE_SERVICE';

export interface IStorageService {
  upload(buffer: Buffer, key: string, mimetype: string): Promise<string>;
}
