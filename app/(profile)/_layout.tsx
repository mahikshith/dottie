import { Stack } from 'expo-router';
import { Colors } from '../../src/constants/colors';
import { Typography } from '../../src/constants/typography';

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
        headerStyle: {
          backgroundColor: Colors.surface.background,
        },
        headerTintColor: Colors.text.primary,
        headerTitleStyle: {
          ...Typography.preset.h4,
          color: Colors.text.primary,
        },
        headerShadowVisible: false,
        headerBackTitle: 'Back',
        contentStyle: {
          backgroundColor: Colors.surface.background,
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
