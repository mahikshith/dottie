/**
 * Dottie — Shared UI Primitives (barrel)
 *
 * Premium, reusable building blocks that activate the design system's
 * motion + depth. All are Reanimated-backed (UI thread, 60fps) and
 * Reduce-Motion aware. Import from '@/components/ui'.
 */

export { PressableScale } from './PressableScale';
export type { PressableScaleProps, PressableScaleHaptic } from './PressableScale';

export { GradientButton } from './GradientButton';
export type { GradientButtonProps } from './GradientButton';

export { GradientFab } from './GradientFab';
export type { GradientFabProps } from './GradientFab';

export { BreathingView } from './BreathingView';
export type { BreathingViewProps } from './BreathingView';

export { PopOnChange } from './PopOnChange';
export type { PopOnChangeProps } from './PopOnChange';

// ─── Aurora system (design-v2 — mood-driven glass/clay/aurora) ──────
export * from './aurora';
