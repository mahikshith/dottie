/**
 * Dottie — Content Updater (OTA · design-v2)
 *
 * Checks for and applies new learning content after launch. It is deliberately
 * transport-agnostic: you inject a `BundleFetcher` (how the bytes arrive — your
 * API, a CDN JSON manifest, EAS Update assets, a CMS export). Until a real
 * fetcher is wired, the default is a no-op, so the app ships offline-first with
 * the update path dormant but ready.
 *
 * ─── FLOW (offline-first, safe) ─────────────────────────────────────
 *
 *   1. Ask the fetcher for a bundle newer than the cached version.
 *   2. If none / offline / error → do nothing (bundled content still works).
 *   3. Validate the bundle; a malformed one is REJECTED, never applied.
 *   4. Only if valid AND newer → cache it. It merges on top at next read.
 *
 * ─── PRIVACY (non-negotiable for a health app) ──────────────────────
 *
 *   Content is generic COHORT content, never personalized — so a fetch must send
 *   NO cycle/health/user data. The fetcher only receives the current content
 *   version (a number). Do not add user identifiers to the request. See
 *   docs/CONTENT-UPDATES.md.
 *
 *  ⚠️ design-v2 / UNVERIFIED (no device).
 */

import { Storage } from '../../database/storage';
import { ContentBundle, validateContentBundle } from './content-bundle';
import { remoteContentStore } from './remote-content-store';

/**
 * How a bundle is obtained. Receives ONLY the current cached version (so the
 * server can say "nothing newer"). Returns a bundle to apply, or null for
 * up-to-date/offline. Throwing is fine — the updater swallows it (offline-first).
 */
export type BundleFetcher = (currentVersion: number) => Promise<ContentBundle | null>;

/** The default: no network wired yet. Keeps the update path dormant + safe. */
export const noopFetcher: BundleFetcher = async () => null;

export interface UpdateResult {
  applied: boolean;
  version?: number;
  reason: 'applied' | 'up-to-date-or-offline' | 'not-newer' | 'invalid' | 'error';
  errors?: string[];
}

export class ContentUpdater {
  constructor(private fetcher: BundleFetcher = noopFetcher) {}

  /**
   * Check for and (if valid + newer) apply an update. Never throws — a failure
   * leaves the existing content untouched. Call this in the background after
   * launch / on reconnect; it should not block the UI.
   */
  async checkForUpdate(): Promise<UpdateResult> {
    const current = remoteContentStore.getVersion();
    let incoming: ContentBundle | null;
    try {
      incoming = await this.fetcher(current);
    } catch {
      return { applied: false, reason: 'error' };
    }

    if (!incoming) return { applied: false, reason: 'up-to-date-or-offline' };
    if (incoming.version <= current) return { applied: false, reason: 'not-newer' };

    const v = validateContentBundle(incoming);
    if (!v.ok) {
      if (__DEV__) console.warn('[ContentUpdater] rejected invalid bundle:', v.errors.slice(0, 5));
      return { applied: false, reason: 'invalid', errors: v.errors };
    }

    remoteContentStore.set(incoming);
    Storage.contentVersion.set(incoming.version);
    return { applied: true, version: incoming.version, reason: 'applied' };
  }
}
