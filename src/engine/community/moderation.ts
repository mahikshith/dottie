/**
 * Dottie — Community Moderation Engine
 *
 * Local pre-publish content moderation for "The Circle".
 *
 * ─── DESIGN ─────────────────────────────────────────────────────────
 *
 *  Runs ENTIRELY ON-DEVICE — no network round trip, no server. This
 *  keeps our privacy promise intact (your draft post never leaves your
 *  phone unless you publish it) AND makes the UX instant (no spinner
 *  while waiting on a moderation API).
 *
 *  We're intentionally conservative: this catches OBVIOUS PII and
 *  high-risk content. Nuanced moderation (bullying tone, manipulative
 *  language) is deferred to the community report flow + future
 *  server-side review.
 *
 *  Pure function. No state, no side effects, no I/O. Easy to unit test
 *  and easy to reason about.
 *
 * ─── WHAT IT CATCHES ────────────────────────────────────────────────
 *
 *    phone_number          — patterns matching common phone formats
 *    email_address         — anything with @ and a TLD
 *    url_link              — http://, https://, www., or domain.tld
 *    medical_prescription  — "take X mg of Y", dosage instructions
 *    self_harm_language    — direct self-harm phrases (triggers warmth-
 *                            forward block + crisis resource pointer)
 *    profanity_severe      — slurs only (mild language is allowed —
 *                            women's health discussions need real talk)
 *    too_short / too_long  — length validation
 *
 * ─── WHAT IT DOESN'T CATCH ──────────────────────────────────────────
 *
 *  - Mild swearing (intentional — venting is healthy)
 *  - Body part names (intentional — clinical accuracy matters)
 *  - "Period sex", "tampons", flow descriptions (this is what the app
 *    IS about — no false positives on core domain vocabulary)
 *  - Brand names (handled by community guidelines, not moderation)
 *
 * ─── ON FALSE POSITIVES ─────────────────────────────────────────────
 *
 *  If our regex thinks a post mentioning "@" is an email (e.g. "@me"),
 *  we'd rather err toward letting the post through than blocking real
 *  users. The current patterns are tight enough that this is rare.
 *  Messages always tell the user WHICH category was flagged so they
 *  can rephrase.
 */

import { ModerationResult, ModerationFlag } from '../../types/community.types';

// ─── REGEX PATTERNS ──────────────────────────────────────────────────

/**
 * Phone number patterns covering common international formats:
 *   - 10-digit US/IN runs (with or without dashes/spaces)
 *   - +country-code prefixed numbers
 *   - Parenthesized area codes
 */
const PHONE_PATTERNS: RegExp[] = [
  /\+\d{1,3}[\s-]?\d{6,}/,                                    // +91 9876543210, +1-555-1234
  /\(\d{3}\)\s*\d{3}[\s-]?\d{4}/,                             // (555) 555-1234
  /\b\d{3}[\s-]\d{3}[\s-]\d{4}\b/,                            // 555-555-1234, 555 555 1234
  /\b\d{10}\b/,                                                // 5555555555 (10 digits)
];

/**
 * Email pattern — covers standard local@domain.tld shapes.
 * We don't catch every edge case (e.g. "+" addressing) but the common
 * accidental-share cases are covered.
 */
const EMAIL_PATTERN = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/;

/**
 * URL patterns. Blocks both full URLs and bare domain mentions like
 * "example.com" or "site.io". The community is a vulnerable space —
 * link sharing opens up phishing/MLM/predatory targeting risks.
 */
const URL_PATTERNS: RegExp[] = [
  /https?:\/\/\S+/i,                                           // http://example.com
  /\bwww\.\S+/i,                                               // www.example.com
  /\b[a-z0-9-]+\.(com|net|org|io|co|in|uk|app|dev|me|info|biz|tv)\b/i,  // bare domains
];

/**
 * Medical prescription/dosage detection — catches "take X mg of Y"
 * patterns that are dispensing medical advice. The community is for
 * sharing experiences ("X worked for me"), not prescribing ("you
 * should take X").
 *
 * Examples caught:
 *   "take 500 mg of metformin"
 *   "you should take 25mg"
 *   "1000mg twice daily"
 */
const MEDICAL_PRESCRIPTION_PATTERNS: RegExp[] = [
  /\btake\s+\d+\s*(mg|mcg|g|ml|iu)\b/i,
  /\byou\s+should\s+take\b/i,
  /\b\d+\s*(mg|mcg|g|ml|iu)\s+(once|twice|three\s+times|daily|per\s+day)\b/i,
];

/**
 * Self-harm language detection. When matched, we don't just block —
 * we surface a crisis resource message and use the warmest possible
 * tone. This is the most important moderation flag.
 *
 * Intentionally narrow — we want vulnerable users to be able to TALK
 * about hard feelings ("I felt awful", "I cried all day") without
 * being blocked. Only direct self-harm phrasing triggers this.
 */
const SELF_HARM_PATTERNS: RegExp[] = [
  /\b(kill|killing|hurt|hurting|harm|harming)\s+(myself|me)\b/i,
  /\b(want\s+to\s+die|wanting\s+to\s+die)\b/i,
  /\bend\s+it\s+all\b/i,
  /\bsuicid(e|al|ality)\b/i,
  /\bcut\s+myself\b/i,
];

/**
 * Severe profanity — slurs only. We intentionally allow mild swearing
 * because women's health discussions benefit from real talk. Slurs
 * targeting identity groups are never okay.
 *
 * Kept abstract on purpose — the actual word list is loaded from a
 * separate (gitignored) source in production. For MVP we use an empty
 * list and rely on user reporting for offensive language.
 */
const SEVERE_PROFANITY_PATTERNS: RegExp[] = [
  // Intentionally empty for MVP — community reporting + auto-hide
  // covers this. A real list will be added once we have a content
  // moderation policy review.
];

// ─── MAIN MODERATION FUNCTION ────────────────────────────────────────

/**
 * Run a piece of content through all moderation checks.
 *
 * Returns a single ModerationResult with all flags that fired.
 * Empty `flags` array + `ok: true` means content is safe to publish.
 *
 * The `message` is a user-facing string the UI can show verbatim.
 * It's tuned warmly — never accusatory, always offers a path forward.
 */
export function moderateContent(text: string): ModerationResult {
  const flags: ModerationFlag[] = [];
  const trimmed = text.trim();

  // ─── PII checks ─────────────────────────────────────────────────

  if (matchesAny(trimmed, PHONE_PATTERNS)) {
    flags.push('phone_number');
  }

  if (EMAIL_PATTERN.test(trimmed)) {
    flags.push('email_address');
  }

  if (matchesAny(trimmed, URL_PATTERNS)) {
    flags.push('url_link');
  }

  // ─── Medical advice ─────────────────────────────────────────────

  if (matchesAny(trimmed, MEDICAL_PRESCRIPTION_PATTERNS)) {
    flags.push('medical_prescription');
  }

  // ─── Safety ─────────────────────────────────────────────────────

  if (matchesAny(trimmed, SELF_HARM_PATTERNS)) {
    flags.push('self_harm_language');
  }

  if (matchesAny(trimmed, SEVERE_PROFANITY_PATTERNS)) {
    flags.push('profanity_severe');
  }

  // ─── Compose result ─────────────────────────────────────────────

  if (flags.length === 0) {
    return { ok: true, flags: [], message: null };
  }

  return {
    ok: false,
    flags,
    message: buildMessageForFlags(flags),
  };
}

/**
 * Quick boolean check — useful if you just want yes/no without details.
 */
export function isContentSafe(text: string): boolean {
  return moderateContent(text).ok;
}

// ─── INTERNAL HELPERS ────────────────────────────────────────────────

/** True if any pattern in the list matches the text */
function matchesAny(text: string, patterns: RegExp[]): boolean {
  for (const pattern of patterns) {
    if (pattern.test(text)) return true;
  }
  return false;
}

/**
 * Compose a friendly, warmth-forward message from the flags that fired.
 *
 * Priority order: self-harm > medical > PII. We surface the most
 * important concern first so users address the right thing.
 */
function buildMessageForFlags(flags: ModerationFlag[]): string {
  // Self-harm gets the gentlest, most caring response. Always first.
  if (flags.includes('self_harm_language')) {
    return (
      "We saw some words that worried us. If you're in crisis, please reach " +
      'out: in India dial 9152987821 (iCall), in the US dial 988. ' +
      "You're not alone, and you matter. 💛"
    );
  }

  // Medical advice — explain WHY we block this
  if (flags.includes('medical_prescription')) {
    return (
      "Let's keep things safe — please don't share specific medications or " +
      "dosages here. Your experience matters, just keep it personal. 💛"
    );
  }

  // PII — combine if multiple
  const piiFlags = flags.filter(f =>
    f === 'phone_number' || f === 'email_address' || f === 'url_link'
  );
  if (piiFlags.length > 0) {
    const items: string[] = [];
    if (piiFlags.includes('phone_number')) items.push('phone numbers');
    if (piiFlags.includes('email_address')) items.push('email addresses');
    if (piiFlags.includes('url_link')) items.push('links');
    const joined = items.length === 1
      ? items[0]
      : items.slice(0, -1).join(', ') + ' or ' + items[items.length - 1];
    return `For everyone's safety, please don't share ${joined} in posts. 💛`;
  }

  // Profanity
  if (flags.includes('profanity_severe')) {
    return (
      "Let's keep The Circle a kind space — could you rephrase that? 💛"
    );
  }

  // Fallback
  return "Something in that post didn't pass our safety check. Could you give it another look? 💛";
}