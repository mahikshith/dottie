import { Stack } from 'expo-router';
import { Colors } from '../../src/constants/colors';
import { Typography } from '../../src/constants/typography';

/**
 * Sisterhood Route Group Layout
 *
 * ─── ROLE ───────────────────────────────────────────────────────────
 *
 *  Wraps every Sisterhood Circle screen in a warm-themed stack
 *  navigator. The dashboard, add-member wizard, member detail screen,
 *  and shadow-logging screens all live here.
 *
 *  Entry points:
 *    Profile tab → "Sisterhood Circle" → /(sisterhood)/circle
 *    Circle "+" / empty CTA → /(sisterhood)/add-member
 *    Member card tap → /(sisterhood)/member/{id}
 *    "Log period" action → /(sisterhood)/shadow-log/{id}/period
 *    "Quick check-in" action → /(sisterhood)/shadow-log/{id}/check-in
 *    "Hand off" action → /(sisterhood)/shadow-log/{id}/transfer
 *
 * ─── DESIGN ─────────────────────────────────────────────────────────
 *
 *  Shadow-logging screens present as bottom-sheet modals — they're
 *  quick, focused tasks that should feel like a brief side-quest from
 *  the member detail screen, not a deep forward navigation.
 *
 *  The add-member wizard uses the same modal presentation for the
 *  same reason: focused side-quest, not main-stack push.
 */
export default function SisterhoodLayout() {
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
        name="circle"
        options={{
          title: 'Sisterhood Circle',
        }}
      />
      <Stack.Screen
        name="add-member"
        options={{
          title: 'Add to circle',
          presentation: 'modal',
          animation: 'slide_from_bottom',
        }}
      />
      <Stack.Screen
        name="member/[id]"
        options={{
          title: '',
        }}
      />
      <Stack.Screen
        name="shadow-log/[id]/period"
        options={{
          title: 'Log period day',
          presentation: 'modal',
          animation: 'slide_from_bottom',
        }}
      />
      <Stack.Screen
        name="shadow-log/[id]/check-in"
        options={{
          title: 'Quick check-in',
          presentation: 'modal',
          animation: 'slide_from_bottom',
        }}
      />
      <Stack.Screen
        name="shadow-log/[id]/transfer"
        options={{
          title: 'Hand off profile',
          presentation: 'modal',
          animation: 'slide_from_bottom',
        }}
      />
    </Stack>
  );
}
