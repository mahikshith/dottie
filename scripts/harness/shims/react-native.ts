/**
 * Dottie — react-native shim (harness only).
 *
 * The data layer touches exactly one RN API — `Platform` — so that is all this
 * provides. Anything else throws on access rather than returning undefined, so
 * a new RN dependency in the data layer fails the harness loudly instead of
 * quietly behaving differently in Node than on device.
 */

export const Platform = {
  OS: 'android' as const,
  Version: 34,
  select: <T,>(spec: { android?: T; ios?: T; default?: T }): T | undefined =>
    spec.android ?? spec.default,
};

export const AppState = {
  currentState: 'active' as const,
  addEventListener: (_t: string, _h: (s: string) => void) => ({ remove: () => {} }),
};
