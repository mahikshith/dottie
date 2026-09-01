/**
 * Dottie — Walkthrough tour store (design-v2 onboarding audit)
 *
 * A tiny Zustand store holding a single "which step is showing" number.
 * Kept OUT of the tab-specific stores so the overlay can live at the app
 * root and read one signal.
 *
 *   startTour()    — sets step 0. First tap after onboarding calls this;
 *                    the Home tab wires it once, gated on
 *                    Storage.walkthroughSeen.
 *   next()         — advances to the next step. Owner call: step-through
 *                    with Next (not auto-advance on tab tap).
 *   skip()         — closes AND sets walkthroughSeen so it doesn't nag.
 *   restart()      — clears the seen flag + starts the tour again. Wired
 *                    from Profile → "Show me around again".
 *
 * Steps are indexed 0..STEPS.length-1. The step ID is what the overlay
 * uses to pick copy AND to route to the right tab (see WalkthroughOverlay).
 */

import { create } from 'zustand';
import { Storage } from '../database/storage';

export type WalkthroughStepId =
  | 'home_mood'
  | 'today_at_a_glance'
  | 'calendar_tab'
  | 'learn_tab'
  | 'circle_tab'
  | 'sisterhood_row'
  | 'doctor_report_row';

export interface WalkthroughStep {
  id: WalkthroughStepId;
  emoji: string;
  title: string;
  body: string;
  /** Which tab (if any) the overlay should route to for this step. */
  routeToTab?: '/(tabs)/home' | '/(tabs)/calendar' | '/(tabs)/learn' | '/(tabs)/community' | '/(tabs)/profile';
}

export const STEPS: WalkthroughStep[] = [
  {
    id: 'home_mood',
    emoji: '💛',
    title: 'A one-tap mood log',
    body: "Tap any mood on the Home hero to log how you feel. Want a full check-in (energy, sleep, symptoms)? Tap the little pencil.",
    routeToTab: '/(tabs)/home',
  },
  {
    id: 'today_at_a_glance',
    emoji: '🌙',
    title: "Today's reading",
    body: "The 'Today at a glance' card shows your sub-phase, what's happening hormonally, and a personal tip if I've noticed a pattern in your logs.",
    routeToTab: '/(tabs)/home',
  },
  {
    id: 'calendar_tab',
    emoji: '📅',
    title: 'Your cycle calendar',
    body: 'Tap any day for phase, gentle suggestions, or to plan ahead. Log a period straight from the sheet. Purple dots mark planned days; red dots mark logged periods.',
    routeToTab: '/(tabs)/calendar',
  },
  {
    id: 'learn_tab',
    emoji: '📖',
    title: 'Bite-sized lessons',
    body: "Learn about your cycle, hormones, and how to work with them. Start anywhere — I'll pick up where you left off.",
    routeToTab: '/(tabs)/learn',
  },
  {
    id: 'circle_tab',
    emoji: '🌷',
    title: 'The Circle',
    body: 'A safe space to share and ask questions — anonymously or as yourself. No judgement, ever.',
    routeToTab: '/(tabs)/community',
  },
  {
    id: 'sisterhood_row',
    emoji: '👯',
    title: 'Care for a loved one',
    body: 'Under You → Sisterhood, you can log periods and check-ins on behalf of a sister, friend or family member. Fully private.',
    routeToTab: '/(tabs)/profile',
  },
  {
    id: 'doctor_report_row',
    emoji: '🩺',
    title: 'One-tap doctor report',
    body: 'Also under You — build a clinician-ready summary of your cycle, symptoms and patterns. Perfect for an appointment.',
    routeToTab: '/(tabs)/profile',
  },
];

interface WalkthroughStore {
  /** null = tour is not showing */
  stepIndex: number | null;

  startTour: () => void;
  next: () => void;
  skip: () => void;
  restart: () => void;
}

export const useWalkthroughStore = create<WalkthroughStore>((set, get) => ({
  stepIndex: null,

  startTour: () => {
    if (Storage.walkthroughSeen.get()) return; // don't nag after seen
    set({ stepIndex: 0 });
  },

  next: () => {
    const cur = get().stepIndex;
    if (cur == null) return;
    if (cur + 1 >= STEPS.length) {
      // Finished naturally — record + close.
      Storage.walkthroughSeen.set();
      set({ stepIndex: null });
      return;
    }
    set({ stepIndex: cur + 1 });
  },

  skip: () => {
    Storage.walkthroughSeen.set();
    set({ stepIndex: null });
  },

  restart: () => {
    Storage.walkthroughSeen.clear();
    set({ stepIndex: 0 });
  },
}));

export const selectWalkthroughStep = (s: WalkthroughStore): WalkthroughStep | null =>
  s.stepIndex == null ? null : (STEPS[s.stepIndex] ?? null);
