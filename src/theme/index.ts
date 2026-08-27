/**
 * Dottie — Aurora theme (design-v2) barrel.
 *
 * The mood-driven palette system. A ThemeProvider/`useAurora()` hook will be
 * added here to hold the active palette (default Nocturne, driven by the
 * latest check-in via `paletteForMood`) and cross-fade on change — built with
 * the `.claude/skills/animate-expo` recipes when we're on a Node machine.
 */

export * from './palettes';
export * from './mood-palette';
export * from './ThemeProvider';
export * from './aurora-static';
