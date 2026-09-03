# Companion & moment animations — attribution

The Lottie animations in `companions/` and `moments/` are from
**Google's Noto Animated Emoji**.

- Source: https://googlefonts.github.io/noto-emoji-animation/
- Project: https://github.com/googlefonts/noto-emoji
- **Licence: Creative Commons Attribution 4.0 International (CC BY 4.0)**
  https://creativecommons.org/licenses/by/4.0/

CC BY 4.0 permits commercial use and modification, and **requires
attribution**. That attribution is surfaced in-app on
Profile → Privacy & data (see `app/(profile)/privacy.tsx`), not only in this
file, because a licence obligation that only lives in the repo isn't discharged
to the people using the app.

| File | Emoji | Codepoint |
|---|---|---|
| `companions/fox.json` | 🦊 | U+1F98A |
| `companions/bunny.json` | 🐇 | U+1F407 |
| `companions/butterfly.json` | 🦋 | U+1F98B |
| `companions/cat.json` | 🐱 | U+1F431 |
| `companions/owl.json` | 🦉 | U+1F989 |
| `companions/blossom.json` | 🌸 | U+1F338 |
| `moments/mindblown.json` | 🤯 | U+1F92F |
| `moments/party.json` | 🎉 | U+1F389 |
| `moments/sparkles.json` | ✨ | U+2728 |
| `moments/fire.json` | 🔥 | U+1F525 |
| `moments/heart.json` | 💛 | U+1F49B |
| `moments/hug.json` | 🤗 | U+1F917 |

## Why these, and what they can't do

They are genuinely open source with a clear, permissive licence — unlike most
"free" character packs, whose terms are usually unclear or non-commercial.

The trade-off, stated plainly: each file is a SINGLE looping performance. A Noto
fox cannot pull a sad face. So emotional range is carried by the layer around
it — playback tempo, scale, a halo, and a `moments/` overlay (🤯 for a perfect
score, 🎉 for a win, 🤗 for a low day). Per-emotion character art would need
commissioned Lotties; `src/content/companion-lottie.ts` already has a slot per
state, so that drops in without touching a screen.
