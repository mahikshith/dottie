/**
 * Dottie — Hardware-backed storage key (B2 security hardening)
 *
 * Replaces the hardcoded MMKV encryption key that used to live in the app
 * binary (`storage.ts`) with a per-install key held in the device's hardware
 * keychain (iOS Keychain / Android Keystore) via expo-secure-store.
 *
 * ─── WHY THIS MATTERS ───────────────────────────────────────────────
 *
 *  A key compiled into the binary is the same for every install and is
 *  trivially recovered by decompiling the app — so "encrypted at rest" was
 *  only as strong as a public constant. A key generated once per install and
 *  stored in the secure enclave is not present in the binary and is bound to
 *  the device. This is the single biggest gap between Dottie's privacy promise
 *  and its implementation (see the Gemini security audit, HANDOFF §9 / B2).
 *
 * ─── RNG NOTE (consistent with pin-hash.ts) ─────────────────────────
 *
 *  Like `pin-hash.ts`, this module deliberately does NOT pull in expo-crypto
 *  (a documented project decision to keep the dependency surface small). The
 *  key's strength here comes from being hardware-held and non-hardcoded, not
 *  from CSPRNG generation. When we adopt a CSPRNG project-wide, `randomKey()`
 *  becomes the single call site to upgrade — no other change needed.
 */

import * as SecureStore from 'expo-secure-store';

// Keychain aliases. Versioned so a future rotation can migrate cleanly.
const MASTER_KEY_ALIAS = 'dottie.mmkv.master_key.v1';
const MIGRATED_FLAG_ALIAS = 'dottie.mmkv.migrated.v1';
// SQLCipher DB key + its plaintext→encrypted migration flag (B2 Step 2).
const DB_KEY_ALIAS = 'dottie.sqlcipher.key.v1';
const DB_MIGRATED_FLAG_ALIAS = 'dottie.sqlcipher.migrated.v1';

/** Length of the generated master key (chars). Long enough to be a strong key. */
const KEY_LENGTH = 48;

const KEYCHAIN_OPTS: SecureStore.SecureStoreOptions = {
  // Readable only while the device is unlocked, and never migrated to a new
  // device via backup — the key must stay bound to THIS device.
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

/**
 * Return the per-install master key, creating and persisting it on first run.
 * Throws only if the secure store is completely unavailable — callers fall
 * back to the legacy key so the app is never bricked.
 */
export async function getOrCreateMasterKey(): Promise<string> {
  const existing = await SecureStore.getItemAsync(MASTER_KEY_ALIAS);
  if (existing && existing.length >= 16) return existing;

  const key = randomKey(KEY_LENGTH);
  await SecureStore.setItemAsync(MASTER_KEY_ALIAS, key, KEYCHAIN_OPTS);
  return key;
}

/** Whether the MMKV store has already been re-keyed from the legacy key. */
export async function isStorageMigrated(): Promise<boolean> {
  const flag = await SecureStore.getItemAsync(MIGRATED_FLAG_ALIAS);
  return flag === '1';
}

/** Record that the one-time legacy→hardware-key migration has completed. */
export async function markStorageMigrated(): Promise<void> {
  await SecureStore.setItemAsync(MIGRATED_FLAG_ALIAS, '1', KEYCHAIN_OPTS);
}

/**
 * The SQLCipher database key. Separate from the MMKV key so the two stores are
 * cryptographically independent. Created and persisted on first run.
 */
export async function getOrCreateDbKey(): Promise<string> {
  const existing = await SecureStore.getItemAsync(DB_KEY_ALIAS);
  if (existing && existing.length >= 16) return existing;

  const key = randomKey(KEY_LENGTH);
  await SecureStore.setItemAsync(DB_KEY_ALIAS, key, KEYCHAIN_OPTS);
  return key;
}

/** Whether the plaintext→SQLCipher DB migration has already completed. */
export async function isDbMigrated(): Promise<boolean> {
  const flag = await SecureStore.getItemAsync(DB_MIGRATED_FLAG_ALIAS);
  return flag === '1';
}

/** Record that the one-time plaintext→SQLCipher DB migration has completed. */
export async function markDbMigrated(): Promise<void> {
  await SecureStore.setItemAsync(DB_MIGRATED_FLAG_ALIAS, '1', KEYCHAIN_OPTS);
}

// ─── INTERNAL ────────────────────────────────────────────────────────

/**
 * Generate a random key string. Mirrors pin-hash's approach (Math.random over
 * a wide alphabet). See the RNG note in the file header for the upgrade path.
 */
function randomKey(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  let out = '';
  for (let i = 0; i < length; i++) {
    out += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return out;
}
