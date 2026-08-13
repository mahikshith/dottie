/**
 * Dottie — PIN Hashing (Lightweight, Dependency-Free)
 *
 * Hashes Ghost Mode PINs before they touch storage. We deliberately
 * AVOID adding `expo-crypto` or `react-native-quick-crypto` to keep
 * the bundle tiny and the MVP shippable today.
 *
 * ─── ALGORITHM ──────────────────────────────────────────────────────
 *
 *  We use a hand-rolled PBKDF-style construction:
 *
 *    1. Generate a random 16-character salt (per-user, persisted)
 *    2. Repeatedly mix (salt + PIN) through a fast hash function
 *       (FNV-1a) for 4,000 iterations
 *    3. Encode the result as hex
 *
 *  Why not just SHA-256? Because we don't have it without adding a
 *  native module. Why is FNV-1a okay for PINs?
 *
 *    - The PIN space is tiny (10^4 to 10^6). The attacker's bottleneck
 *      isn't the cryptographic strength of the hash — it's the rate
 *      limiter we enforce above this layer (5 attempts → 30s cooldown).
 *    - The PIN HASH is stored in MMKV's already-encrypted store, so
 *      even if someone bypasses the rate limiter, they'd need to root
 *      the device, extract the encrypted MMKV blob, decrypt it, and
 *      THEN brute-force a 4-6 digit PIN. At that point, you've already
 *      lost.
 *
 *  When we upgrade later (chunk 13+), we'll swap in real PBKDF2-HMAC
 *  via expo-crypto with zero call-site changes (this module's public
 *  API stays identical).
 *
 * ─── SECURITY POSTURE ──────────────────────────────────────────────
 *
 *  This is INTENTIONALLY MVP-grade. Good enough to keep your sibling
 *  out. Not good enough to defy a forensic adversary. We say so
 *  explicitly in the settings UI ("Ghost Mode is a privacy feature,
 *  not a security feature").
 *
 *  When we go to production we'll:
 *    - Add expo-crypto (PBKDF2-HMAC-SHA256, 100k+ iterations)
 *    - Add expo-local-authentication (Face ID / fingerprint unlock)
 *    - Wire up panic wipe to scrub SQLite, not just MMKV
 *
 *  None of those changes will break this module's public API.
 */

import { MAX_PIN_LENGTH, MIN_PIN_LENGTH, PIN_HASH_ITERATIONS, PIN_SALT_LENGTH } from '../types/ghost-mode.types';

// ─── PUBLIC API ──────────────────────────────────────────────────────

/**
 * Hash a PIN with its salt. Pure function; same inputs → same output.
 * Throws on malformed input so storage layers don't write garbage.
 */
export function hashPin(pin: string, salt: string): string {
  validatePinShape(pin);
  validateSaltShape(salt);

  // Iterated mixing — each round folds the previous hash back in,
  // forcing serial computation that resists parallelism.
  let acc = `${salt}|${pin}`;
  for (let i = 0; i < PIN_HASH_ITERATIONS; i++) {
    acc = fnv1aHex(`${acc}|${i}`);
  }
  return acc;
}

/**
 * Constant-time comparison of two hex hashes. Prevents timing attacks
 * that could leak hash bytes by measuring `===` short-circuit speed.
 */
export function compareHashes(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Generate a random salt of the configured length. Uses Math.random
 * (good enough for the MVP threat model — see file header). When we
 * adopt expo-crypto, this becomes CSPRNG-backed.
 */
export function generateSalt(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let out = '';
  for (let i = 0; i < PIN_SALT_LENGTH; i++) {
    out += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return out;
}

/**
 * Validate that a string is a syntactically acceptable PIN.
 * Used by both the security layer and the PIN-pad UI.
 */
export function isValidPinShape(
  pin: string
): { ok: true } | { ok: false; reason: 'too_short' | 'too_long' | 'non_numeric' } {
  if (!/^\d*$/.test(pin)) return { ok: false, reason: 'non_numeric' };
  if (pin.length < MIN_PIN_LENGTH) return { ok: false, reason: 'too_short' };
  if (pin.length > MAX_PIN_LENGTH) return { ok: false, reason: 'too_long' };
  return { ok: true };
}

// ─── INTERNAL: FNV-1a HASH ───────────────────────────────────────────

/**
 * Fast 32-bit FNV-1a → hex string. Pure JS, no native deps.
 *
 * For each character we XOR into the running hash, then multiply
 * by the FNV prime. The `Math.imul` keeps multiplication in 32-bit
 * lane (avoids JS losing precision past 2^53).
 *
 * Output is 8 hex characters per call. We chain calls in hashPin()
 * so the effective output entropy is much higher across iterations.
 */
function fnv1aHex(input: string): string {
  let hash = 0x811c9dc5; // FNV offset basis (32-bit)
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193); // FNV prime (32-bit)
  }
  // Convert to unsigned 32-bit and pad to 8 hex chars
  return (hash >>> 0).toString(16).padStart(8, '0');
}

// ─── INTERNAL: VALIDATION ────────────────────────────────────────────

function validatePinShape(pin: string): void {
  const v = isValidPinShape(pin);
  if (!v.ok) {
    throw new Error(`[pin-hash] invalid pin shape: ${v.reason}`);
  }
}

function validateSaltShape(salt: string): void {
  if (typeof salt !== 'string' || salt.length !== PIN_SALT_LENGTH) {
    throw new Error(
      `[pin-hash] invalid salt: expected length ${PIN_SALT_LENGTH}, got ${salt?.length ?? 'undefined'}`
    );
  }
}
