# 🔭 Dottie — Next-Features Implementation Research

> Implementation-prep for the top roadmap gaps (see HANDOFF §0.9). Grounded in a
> 2026 web scan so the next session can build fast. **design-v2 · ⚠️ nothing here
> is wired yet — research + plan only.**

## 0. Recommended build order (each unlocks the next)

1. **Notification scheduler service** (foundational) — wraps the copy that ALREADY exists
   in `src/notifications/copy.ts`. Unlocks period heads-ups, hydration nudges, streak-at-risk.
2. **Birth-control / medication reminders** — the universally-requested feature; sits on #1.
3. **HealthKit / Health Connect read** — the accuracy frontier; native, bigger lift, dev build.

All three are **local-first + opt-in** — consistent with Dottie's privacy stance (data stays
on device; nothing is sent anywhere).

## 1. Notifications — `expo-notifications` (local, no server)

Key facts:
- **Local scheduled notifications need NO server** and work in Expo Go / dev build — perfect for
  reminders. (Remote *push* needs a dev build + real hardware; we don't need push for reminders.)
- **iOS:** must request permission explicitly at init; repeating `TIME_INTERVAL` triggers must be
  ≥ 60s; `CALENDAR` trigger is iOS-only.
- **Android 12+:** exact-time scheduling needs the `SCHEDULE_EXACT_ALARM` permission; if the user
  permanently denies, you can't re-prompt — check status first and deep-link to settings.
- **Cross-platform triggers:** `DAILY` / `WEEKLY` / `MONTHLY` / `YEARLY` work on both.
- **Persist scheduled reminders** (e.g. in MMKV/SQLite) so they can be **restored after reinstall**;
  always **test on a physical device**.

Plan for Dottie:
- Add `expo-notifications` (needs `npx expo install` on a Node machine + a dev build).
- A `NotificationScheduler` service that reads `getNotificationCopy(kind, mode)` (discrete/explicit
  already built) and schedules: `check_in_reminder` (daily), `period_window_approaching` (from the
  Bayesian prediction), `check_in_streak_at_risk`, plus new kinds below.
- Respect `Storage.discreteNotifications`; add a settings screen to toggle per-kind.

Sources: [Expo Notifications docs](https://docs.expo.dev/versions/latest/sdk/notifications/) ·
[local notifications 2026 guide](https://www.codesofphoenix.com/articles/expo/local-notifications-expo) ·
[Android 12+/iOS gotchas](https://medium.com/@gligor99/making-expo-notifications-actually-work-even-on-android-12-and-ios-206ff632a845)

## 2. Birth-control / medication reminders

UX patterns that drive adherence (from the reminder-app market):
- **Daily reminder at a user-chosen time**; optional **persistent re-nudges** (e.g. every hour until
  marked taken); **snooze**; custom tone.
- **Missed-dose handling:** show it immediately in a **visual calendar history**; let the user note
  why; spotting patterns builds consistency.
- **Pack management:** track **placebo / break days** and remind to **restart the next pack** — a
  top confusion point for pill users. Support pill / ring / patch / injection / IUD / implant.
- Optional cross-device (Watch) later.

Plan for Dottie:
- New MMKV/SQLite model: `MedicationPlan { method, times[], packSchedule?, startDate }` + a
  `medication_log` (taken/missed/notes). (Additive — use `ensureTables()`, no schema bump.)
- New `NotificationKind`s: `medication_reminder`, `birth_control_reminder` (discrete + explicit).
- Replace the Profile "Medications" stub with a real screen; schedule via the #1 service.

Sources: [pill reminder UX](https://www.mytherapyapp.com/contraceptive-pill-reminder-app) ·
[reminder best practices](https://careclinic.io/birth-control-reminder/)

## 3. Wearable / OS health integration (accuracy frontier)

**iOS — Apple HealthKit** (not in Expo Go → dev build + config plugin + Info.plist usage strings):
- Libraries: **`@kingstinct/react-native-healthkit`** (TypeScript, Expo via custom dev client) or
  `react-native-health`.
- Relevant types to READ: `HKCategoryTypeIdentifierMenstrualFlow`,
  `HKQuantityTypeIdentifierBasalBodyTemperature`,
  `HKQuantityTypeIdentifierAppleSleepingWristTemperature` (Apple Watch), HRV, sleep.
- Also **WRITE** menstrual flow so Dottie plays nicely with the Apple Health ecosystem (opt-in).

**Android — Health Connect** (Google's unified health API; `react-native-health-connect`):
- Permissions in `AndroidManifest.xml`: `android.permission.health.READ_MENSTRUATION` (+ `WRITE_`),
  and temperature/sleep record types.
- Request via `requestPermission({ accessType, recordType: 'Menstruation' | 'BasalBodyTemperature' | … })`;
  add the plugin + permissions to `app.json`.

Why it matters: nightly **skin/basal temperature** is what pushed Oura to ~96% ovulation-detection
accuracy — feeding it into Dottie's Bayesian predictor would sharpen predictions **and cut manual
logging**. Data stays on-device (aligns with our privacy stance); make it **opt-in** with clear copy.

Sources: [@kingstinct/react-native-healthkit](https://github.com/kingstinct/react-native-healthkit) ·
[react-native-health](https://github.com/agencyenterprise/react-native-health) ·
[RN Health Connect](https://matinzd.github.io/react-native-health-connect/docs/permissions/) ·
[Health Connect + RN guide](https://tapan-7.medium.com/integrating-health-connect-in-android-react-native-apps-9cb7406b38db)

## 4. Privacy framing (applies to all three)

Every one of these is **opt-in and local**: reminders are scheduled on-device; HealthKit/Health
Connect data never leaves the phone; no third parties. This is Dottie's edge — surface it in the
consent copy for each feature (a small trust win competitors can't easily claim).
