/**
 * Dottie — react-native-mmkv shim (harness only)
 *
 * An in-memory MMKV with the same synchronous surface. The diagnostics logger
 * writes through to MMKV on every event, and `Storage` holds onboarding state,
 * the current user id and the day-plan cache — so without this the harness
 * couldn't run a single store call.
 *
 * `encryptionKey` is accepted and ignored: this never touches disk and never
 * leaves the process, so there is nothing to encrypt. It is not a security
 * component and must never be imported by the app.
 */

export class MMKV {
  private readonly map = new Map<string, string | number | boolean>();
  readonly id: string;

  constructor(opts?: { id?: string; encryptionKey?: string }) {
    this.id = opts?.id ?? 'default';
  }

  set(key: string, value: string | number | boolean): void {
    this.map.set(key, value);
  }
  getString(key: string): string | undefined {
    const v = this.map.get(key);
    return typeof v === 'string' ? v : undefined;
  }
  getNumber(key: string): number | undefined {
    const v = this.map.get(key);
    return typeof v === 'number' ? v : undefined;
  }
  getBoolean(key: string): boolean | undefined {
    const v = this.map.get(key);
    return typeof v === 'boolean' ? v : undefined;
  }
  contains(key: string): boolean {
    return this.map.has(key);
  }
  delete(key: string): void {
    this.map.delete(key);
  }
  getAllKeys(): string[] {
    return [...this.map.keys()];
  }
  clearAll(): void {
    this.map.clear();
  }
  recrypt(_key?: string): void {}
}

export default { MMKV };
