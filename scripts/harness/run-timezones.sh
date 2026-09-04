#!/usr/bin/env bash
# Dottie — run the simulated-user harness across timezones.
#
# The period-log freeze (device-test-7) existed for four rounds because every
# test ran at UTC+0, where the broken date helper was accidentally correct. A
# single-timezone integration run would repeat that mistake, so the full user
# journey is replayed either side of Greenwich, including the owner's own
# timezone. Any failure fails the whole script.
set -u
ZONES=(UTC Asia/Kolkata America/New_York Europe/London Pacific/Kiritimati)
FAILED=0
for tz in "${ZONES[@]}"; do
  printf '\n\033[36m════ TZ=%s ════\033[0m\n' "$tz"
  if TZ="$tz" node --require ./scripts/harness/alias.cjs --require tsx/cjs --import tsx \
      scripts/app-simulation-harness.ts 2>&1 | grep -v ExperimentalWarning | grep -v trace-warnings; then
    :
  else
    FAILED=1
    printf '\033[31m✗ simulated user run FAILED under TZ=%s\033[0m\n' "$tz"
  fi
done
if [ "$FAILED" -eq 0 ]; then
  printf '\n\033[32m✓ Simulated user run clean in all %d timezones.\033[0m\n' "${#ZONES[@]}"
fi
exit "$FAILED"
