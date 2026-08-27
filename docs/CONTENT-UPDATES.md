# 📥 Dottie — Over-the-Air Content Updates

> How Dottie ships **new lessons (and quizzes, exercises, paths) after launch**
> without an app-store update — the way the code is wired today, and the one
> decision left (where the content is hosted). **design-v2 · ⚠️ seam built, no
> backend wired yet.**

## The answer, briefly

Yes — the app is built to update its learning content over the internet, and the
seam is in place. The model is **offline-first**: the app always ships a bundled
baseline of content that works with zero network, and any downloaded content is
**merged on top**. So a user is never blocked waiting on a download, and new
lessons appear automatically once fetched.

## How it flows

```
 launch ──► bundled content (always present, offline)
              ▲
              │ merged on top (cached wins by id)
 network ──► ContentUpdater.checkForUpdate()
              → fetcher(currentVersion)  ← sends ONLY a version number
              → validateContentBundle()  ← malformed = rejected, never shown
              → remoteContentStore.set() ← cached in MMKV, survives restarts
```

- **Baseline:** `src/content/learning-paths.ts`, `quizzes.ts`, `exercises.ts`.
- **Merge:** `src/content/remote/merged-providers.ts` (lessons/quizzes) + the
  OTA-aware `getExercisesForLesson` in `exercises.ts`. Cached items override
  bundled ones **by id**; new ids are added. With nothing cached, behaviour is
  identical to bundled — already wired into `hydrate.ts`, safely dormant.
- **Cache:** `src/content/remote/remote-content-store.ts` (MMKV via
  `Storage.remoteContentBundle`, memoised so hot lookups don't re-parse).
- **Update check:** `src/content/remote/content-updater.ts` —
  `new ContentUpdater(fetcher).checkForUpdate()`; never throws, applies only a
  **valid, newer** bundle. Version tracked in `Storage.contentVersion`.
- **Bundle shape + validation:** `src/content/remote/content-bundle.ts`
  (`ContentBundle` = `{ version, updatedAt, paths[], lessons[], quizzes[],
  exercises[] }`, validated with the same validators the bundled content passes).

## Privacy (non-negotiable for a health app)

Learning content is **generic cohort content — never personalized per user**, so
fetching it must send **no cycle/health/user data**. The `BundleFetcher` only
receives the current content version (a number). Do not add identifiers, phase,
or symptoms to the request. (Personalization is the companion-voice wrapper, done
locally — it never leaves the device.)

## The one decision left: where content is hosted

Pick a transport and implement one `BundleFetcher`
(`(currentVersion) => Promise<ContentBundle | null>`):

1. **Static JSON manifest on a CDN / your API** (simplest, recommended to start):
   host `content/latest.json` (a `ContentBundle`); the fetcher GETs it, returns
   it if `version > currentVersion`, else null. Cache-friendly, cheap, no SDK.
2. **EAS Update** (`expo-updates`): ships JS + assets OTA for the whole app. Good
   for shipping code+content together; heavier, tied to build channels. Content
   can still ride as a bundled JSON updated via EAS.
3. **Headless CMS** (Sanity/Contentful/etc.): editors manage lessons; a small
   export step produces the `ContentBundle` the fetcher pulls. Best once a
   content team exists.

Then wire it once (e.g. in the app root, after hydration, in the background):

```ts
import { ContentUpdater } from '@/content/remote/content-updater';
const updater = new ContentUpdater(myFetcher);
updater.checkForUpdate().then((r) => { if (r.applied) { /* refresh Learn */ } });
```

## Notes / follow-ups

- **When updates take effect:** merged lookups read the cache live, so applied
  content shows on the next Learn render; a full re-hydrate guarantees engines
  pick it up. Consider a light "new lessons available" nudge.
- **Integrity:** validation is structural. If bundles are served from a
  third party, also verify a signature/hash before `set()`.
- **Size:** keep bundles lean; images in lessons should be URLs or use the
  asset-update path, not inlined base64.
- **Rollback:** `remoteContentStore.clear()` drops back to the bundled baseline.
