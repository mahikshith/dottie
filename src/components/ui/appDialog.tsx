/**
 * Global themed dialog — a drop-in replacement for the native `Alert.alert`.
 *
 * Native alerts render OS-white boxes we can't theme (beta testers flagged them
 * everywhere). Instead: call `showAppDialog({ title, body?, actions })` from
 * anywhere (no hooks, no local state), and the single <AppDialogHost/> mounted
 * at the root renders our warm CelebrationDialog. Each action auto-closes the
 * dialog before its onPress runs.
 *
 *   Alert.alert('Discard?', 'Your post will be lost.', [
 *     { text: 'Keep writing', style: 'cancel' },
 *     { text: 'Discard', style: 'destructive', onPress: doDiscard },
 *   ]);
 *   // becomes →
 *   showAppDialog({
 *     emoji: '📝', title: 'Discard this draft?', body: 'Your post will be lost.',
 *     actions: [
 *       { label: 'Keep writing', variant: 'ghost', onPress: () => {} },
 *       { label: 'Discard', variant: 'danger', onPress: doDiscard },
 *     ],
 *   });
 */

import { create } from 'zustand';
import { CelebrationDialog, type DialogAction } from './CelebrationDialog';

export interface AppDialogConfig {
  emoji?: string;
  title: string;
  body?: string;
  actions: DialogAction[];
}

interface AppDialogState {
  config: AppDialogConfig | null;
  show: (config: AppDialogConfig) => void;
  hide: () => void;
}

const useAppDialogStore = create<AppDialogState>((set) => ({
  config: null,
  show: (config) => set({ config }),
  hide: () => set({ config: null }),
}));

/** Imperative themed dialog. Safe to call from anywhere (handlers, effects). */
export function showAppDialog(config: AppDialogConfig): void {
  const wrapped: AppDialogConfig = {
    ...config,
    actions: config.actions.map((a) => ({
      ...a,
      onPress: () => {
        useAppDialogStore.getState().hide();
        a.onPress();
      },
    })),
  };
  useAppDialogStore.getState().show(wrapped);
}

/** Mounted once at the root so any screen's showAppDialog() renders here. */
export function AppDialogHost(): JSX.Element {
  const config = useAppDialogStore((s) => s.config);
  const hide = useAppDialogStore((s) => s.hide);
  return (
    <CelebrationDialog
      visible={config !== null}
      emoji={config?.emoji ?? '🌙'}
      title={config?.title ?? ''}
      body={config?.body}
      actions={config?.actions ?? []}
      onRequestClose={hide}
    />
  );
}
