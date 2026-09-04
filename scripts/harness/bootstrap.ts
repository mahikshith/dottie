/**
 * Dottie — harness bootstrap
 *
 * Globals the React Native runtime provides that Node does not. Imported FIRST
 * by every harness entry point, before any app module, because `__DEV__` is
 * read at module scope in places.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).__DEV__ = false;
