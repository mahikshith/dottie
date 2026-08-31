import { Stack } from 'expo-router';
import { Typography } from '../../src/constants/typography';
import { A } from '../../src/theme';

/**
 * Profile Route Group Layout
 *
 * ─── ROLE ───────────────────────────────────────────────────────────
 *
 *  Wraps every deep profile screen (Doctor Report, Ghost Mode, future
 *  Medications, Notifications, etc.) in a warm-themed stack navigator.
 *
 *  Entry points:
 *    Profile tab → "Doctor Report" → /(profile)/doctor-report
 *    Profile tab → "Ghost Mode"    → /(profile)/ghost-mode  ← NEW
 *
 * ─── DESIGN ─────────────────────────────────────────────────────────
 *
 *  Mirrors the (sisterhood) layout pattern so the navigation feels
 *  consistent: warm background, no shadow under the header, friendly
 *  "Back" label, slide-from-right push transitions.
 */
export default function ProfileLayout() {
  return (
    <Stack
      screenOptions={{
        // Aurora-native chrome (was cream Colors.surface.background — that
        // painted a white bar over the notch/status area on ghost-mode /
        // reminders / privacy). Deep profile screens themselves stay themed.
        headerStyle: {
          backgroundColor: A.ground,
        },
        headerTintColor: A.ink,
        headerTitleStyle: {
          ...Typography.preset.h4,
          color: A.ink,
        },
        headerShadowVisible: false,
        headerBackTitle: 'Back',
        contentStyle: {
          backgroundColor: A.ground,
        },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen
        name="doctor-report"
        options={{
          title: 'Doctor Report',
        }}
      />
      <Stack.Screen
        name="ghost-mode"
        options={{
          title: 'Ghost Mode',
        }}
      />
    </Stack>
  );
}
