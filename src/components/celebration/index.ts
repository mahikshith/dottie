/**
 * Dottie — Celebration Components Public API
 *
 * Barrel export for the celebration primitives used by:
 *   • app/(modals)/streak-celebration.tsx
 *   • app/(modals)/level-up.tsx
 *   • app/(modals)/checkin-recap.tsx
 *
 * Anywhere a celebration moment is shown, components should import from
 * here — never from individual files in this folder.
 *
 *   import {
 *     CelebrationSheet,
 *     StreakFlame,
 *     MilestoneBanner,
 *     RewardChip,
 *   } from '@/components/celebration';
 */

export { CelebrationSheet } from './CelebrationSheet';
export type { CelebrationSheetProps } from './CelebrationSheet';

export { StreakFlame } from './StreakFlame';
export type { StreakFlameProps } from './StreakFlame';

export { MilestoneBanner } from './MilestoneBanner';
export type { MilestoneBannerProps } from './MilestoneBanner';

export { RewardChip } from './RewardChip';
export type { RewardChipProps, RewardKind } from './RewardChip';
