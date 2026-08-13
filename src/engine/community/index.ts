/**
 * Dottie — Community Engine Barrel
 *
 * Public API for the community engine layer. Pure functions only —
 * no I/O, no state. Anything that needs persistence or React state
 * lives in the store, not here.
 */

export { moderateContent, isContentSafe } from './moderation';