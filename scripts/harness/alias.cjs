/**
 * Dottie — harness module alias (CommonJS resolver patch)
 *
 * Redirects the five native-only packages to the harness shims.
 *
 * Why not tsconfig `paths`: for a specifier that ALSO exists in node_modules
 * (`react-native` does) the real package wins, and esbuild then chokes on its
 * Flow syntax. Why not an ESM resolve hook: tsx compiles this project to CJS,
 * so the imports become `require()` calls that ESM hooks never see. Patching
 * `Module._resolveFilename` is the one place that catches every case.
 *
 * Harness only — loaded via `--require`, never part of the app bundle.
 */
const path = require('node:path');
const Module = require('node:module');

const shim = (f) => path.join(__dirname, 'shims', f);

const ALIASES = {
  'expo-sqlite': shim('expo-sqlite.ts'),
  'react-native-mmkv': shim('react-native-mmkv.ts'),
  'expo-secure-store': shim('expo-secure-store.ts'),
  'expo-notifications': shim('expo-notifications.ts'),
  'react-native': shim('react-native.ts'),
  'expo-constants': shim('expo-constants.ts'),
};

const original = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  const hit = ALIASES[request];
  if (hit) return hit;
  return original.call(this, request, ...rest);
};

// The RN runtime provides this; Node does not, and it is read at module scope.
globalThis.__DEV__ = false;
