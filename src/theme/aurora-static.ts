/**
 * Dottie — Static Aurora Tokens (design-v2)
 *
 * Fixed Nocturne aurora colours for screens that use static `StyleSheet.create`
 * and don't need per-MOOD recolouring (utility/flow screens: onboarding, deep
 * sisterhood/community, doctor report, security). The live-palette ground still
 * comes from `<AuroraBackground>`, and the glass tints read the same on any
 * aurora ground — so these constants keep large screens simple without a hook.
 *
 * For dynamic, per-mood colour (Home, check-in, tabs) use `useAurora().palette`
 * instead — that's what makes the app recolour on a mood log.
 *
 * Values mirror the Nocturne palette in `palettes.ts` (the pre-log default).
 */
export const A = {
  ground: '#0C0A16',
  ground2: '#120E20',
  ink: '#F3EEFF',
  ink2: '#B8AED6',
  ink3: '#8B82A8',
  glass: 'rgba(255,255,255,0.06)',
  glass2: 'rgba(255,255,255,0.09)',
  edge: 'rgba(255,255,255,0.14)',
  edgeBright: 'rgba(255,255,255,0.28)',
  accent: '#54E6C8',
  accent2: '#9B7BFF',
  gold: '#FFC24D',
  rose: '#FF6FA5',
  success: '#6FE6A8',
  error: '#FF7A8A',
} as const;
