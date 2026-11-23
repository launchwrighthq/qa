// An in-memory storage disk with the `StorageDriver` surface that `publishReport` writes to. The
// framework storage module has the full fake; the library tests need only put, presign and supports.
import type { StorageDriver } from '../../src/services/peers.mts';

interface FakeObject {
  bytes: Buffer;
  contentType: string;
}

/** `presign` gives `https://fake-storage.invalid/<key>?X-Fake-Method=<m>&X-Fake-Expires=<seconds>`. */
export class FakeStorageDriver implements StorageDriver {
  readonly objects = new Map<string, FakeObject>();

  supports(capability: string): boolean {
    return capability === 'presign';
  }

  async put(key: string, body: Buffer, options: { contentType: string }): Promise<void> {
    this.objects.set(key, { bytes: Buffer.from(body), contentType: options.contentType });
  }

  async presign(key: string, options: { method: string; expiresIn: number }): Promise<string> {
    const url = new URL(`https://fake-storage.invalid/${key}`);
    url.searchParams.set('X-Fake-Expires', String(options.expiresIn));
    url.searchParams.set('X-Fake-Method', options.method);
    return url.toString();
  }
}
