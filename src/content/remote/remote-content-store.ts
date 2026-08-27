/**
 * Dottie — Remote Content Store (OTA · design-v2)
 *
 * The cached, on-device copy of the last validated ContentBundle. Reads/writes
 * MMKV via `Storage.remoteContentBundle` and memoises the parsed bundle so the
 * hot lookups (merged providers, `getExercisesForLesson`) don't re-parse JSON on
 * every call. Bundled content is the baseline; this is what gets merged on top.
 *
 *  ⚠️ design-v2 / UNVERIFIED (no device).
 */

import { Storage } from '../../database/storage';
import type { ContentBundle } from './content-bundle';

// undefined = not loaded yet; null = loaded, nothing cached.
let memo: ContentBundle | null | undefined = undefined;

export const remoteContentStore = {
  /** The cached bundle, or null if none has been applied. Parsed once per session. */
  get(): ContentBundle | null {
    if (memo === undefined) memo = Storage.remoteContentBundle.get<ContentBundle>();
    return memo;
  },
  /** Version of the cached bundle (0 if none) — the baseline the updater compares against. */
  getVersion(): number {
    return this.get()?.version ?? 0;
  },
  /** Persist a validated bundle and refresh the memo. */
  set(bundle: ContentBundle): void {
    Storage.remoteContentBundle.set(bundle);
    memo = bundle;
  },
  /** Forget the cached bundle (e.g. a "reset content" action). */
  clear(): void {
    Storage.remoteContentBundle.clear();
    memo = null;
  },
};
