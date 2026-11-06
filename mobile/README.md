# Mangwaoo Mobile

Android/iOS Expo app with a native navigation shell around the live Mangwaoo website. It uses the website's existing authentication, APIs and database directly. There is no separate mobile catalog or account database, so the website's products, prices, stock, cart, orders, saved addresses and dashboards are the same in the app.

Register in either place and sign in with the same credentials in the other. App and browser have separate login sessions; signing in on one does not automatically sign in the other. The existing server-set httpOnly cookies are handled by WebView; the app never reads passwords/tokens from storage or sets cookies.

## Run

From `mobile/`:

```sh
npm install
npm start
```

Open on Android/iOS using a compatible Expo Go (SDK 58) or a development build. `npm run web` offers a link to the real website because native WebView is not supported in web browsers.

The default website is `https://mangwaoo.vercel.app`. Set the public website origin in `mobile/.env` and in EAS before building for the owner's live domain:

```env
EXPO_PUBLIC_API_URL=https://YOUR-LIVE-DOMAIN
```

Only the website origin belongs here. Never copy the root `.env.local`, database credentials, AUTH_SECRET or other server secrets into the app. Release builds require HTTPS. For local development use `http://YOUR_COMPUTER_LAN_IP:3000` and start the website on your network.

## App experience

- Branded header, basket shortcut, Food / Shopping / Mart / Reels / Orders / Account navigation, safe areas and device light/dark theme.
- The complete live website runs inside one WebView, including registration, phone verification, password reset, customer chat, tracking, seller/rider/admin/ASM dashboards. Dashboard pages retain their own navigation.
- Android Back and iOS swipe navigation, loading progress, reload and a connection-error retry screen.
- Tap the location icon to allow the app to use GPS, then use the website's address picker. Location and microphone use require device testing and native permission prompts.
- External links open in their appropriate apps/browser; same-origin pages stay in the app. Verification and map subframes remain subject to the website CSP.

This is a website-backed app, not a separate set of native marketplace screens. Website changes appear immediately; native shell changes require a new app build. Internet is required. Web Push/service workers are not a reliable notification mechanism inside WebView; native background push needs a separate integration. Firebase reCAPTCHA/SMS, voice recording, uploads, location and payment links must be checked on physical Android/iOS devices before release.

## Check and build

```sh
npx tsc --noEmit
node --experimental-strip-types --test tests/navigation.test.mjs tests/history.test.mjs tests/web-navigation.test.mjs
npx expo export --platform android
npx eas-cli@27.4.1 login
npx eas-cli@27.4.1 init --id 7ca367d0-7c54-4787-9895-4c2fdefaec3b
npx eas-cli@27.4.1 build --platform android --profile preview
```

The preview profile produces an installable Android APK. Store builds use `--profile production`; iOS requires Apple signing. EAS login/project setup and signing credentials are required. No APK or store release is produced just by editing these sources.

Validation in this workspace: TypeScript, ESLint, navigation tests, Expo dependency compatibility and Expo fingerprint generation pass; Android and iOS JavaScript exports pass with `--no-bytecode`. The Windows policy blocks local `hermesc.exe`; Android APK generation succeeded on EAS instead.

The app is linked to the owner's `mangwaoocomdeliveryservicess-team` project. [Latest Android Back-fix build](https://expo.dev/accounts/mangwaoocomdeliveryservicess-team/projects/mangwaoo-delivery-service/builds/8f8356b6-d478-4759-83f0-f078ac419fa5), [download APK](https://expo.dev/artifacts/eas/Uznq5TTOQdLzfF4J1BfmPs50-99cxlEE2najIPUUUDg.apk). The root `.easignore` excludes the website and local credentials; the reviewed archive contained only 13 mobile source/configuration/test files. Review the archive again before future builds if new files are added to the repository root.

Physical-device checks on Samsung SM-A075F / Android 16 verified installation, live Home/Food/Mart screens, the owner's website-account login, account Settings, session retention across an APK update, light/dark rendering and the Android location permission prompt. GPS permission was left ungranted. The latest APK passed a controlled fresh-launch test: Home → Food → pending Mart → Back to Food → Back to Home → signed-in Account Settings. History is recorded from native tab taps and website History API changes, never from document-load callbacks. All 9 navigation/bridge regression tests, TypeScript and ESLint checks pass. Actual GPS positioning, voice/uploads and real checkout were not exercised.

Dependency security: the full `npm audit` and `npm audit --omit=dev` both report **0 vulnerabilities** after updating Expo to 58.0.23 and its compatible transitive packages. Expo-scoped overrides pin `glob` to 14.0.2 and `minimatch` to 11.0.1, the patched versions for [GHSA-3g3m-2fjr-6pw4](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4) and [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249). These cross the transitive packages' major-version ranges, so both platform bundles and the fingerprint generator were checked. Keep the overrides until upstream Expo accepts patched versions; recheck them when upgrading Expo. No SDK downgrade was applied.

APK SHA-256: `2793742D747777909D2AEA2233652555153A86A8DFF1FC5D456783C4E277722D`. The tested local artifact is `mobile/.expo/builds/mangwaoo-v1.0.0-navigation.apk`; device results are in `mobile/.expo/device-test/final-controlled-results.json` (both directories are ignored by Git).

## Version 1.1 testing build

The launcher and native splash use the supplied glossy red M artwork in assets/. This version adds food-first navigation and the shared website reel/moderation and vendor-delivery workflows. See ../docs/food-reels-delivery.md for limits and routing rules. Native navigation tests: 10 passing. Website feature checks: 37 passing with temporary database fixtures and notifications stubbed. Website production build and browser layout/composer checks passed; no new device test was requested for this release.

Live website validation also checked synthetic camera recording, a playable preview, stopping camera/microphone tracks on close, and stopping a permission request that resolves after the composer closes. No video was uploaded during browser tests. Expo install --check reports dependencies up to date; Expo full audit and website production audit both report zero advisories.

Testing build page: https://expo.dev/accounts/mangwaoocomdeliveryservicess-team/projects/mangwaoo-delivery-service/builds/78f62659-04bd-4680-94ce-3403beb89ea0

Version 1.1.0 (Android build 2) direct APK: https://expo.dev/artifacts/eas/WGGJU0C2lqn0YTgKes1HUT_BrW3MoJDMmXzC1NswNIk.apk

APK SHA-256: `7BA5A8BFE71DD98476E58D92C122BB42F76C8141E777B5D8C30D4651FF6A776B`. Installed successfully as an update on the Samsung SM-A075F; Android reported package `pk.mangwaoo.app`, `versionName=1.1.0`, `versionCode=2`.

## Version 1.1.1 camera-fix build

This build requests Android camera and microphone permissions through the native app before recording, supports reels up to 60 seconds, and hides the website footer only inside the app. The public website navbar and footer remain unchanged.

Testing build page: https://expo.dev/accounts/mangwaoocomdeliveryservicess-team/projects/mangwaoo-delivery-service/builds/57334d62-7dea-48e1-babb-bd4d397b0227

Version 1.1.1 (Android build 3) direct APK: https://expo.dev/artifacts/eas/WzInDXqqDnVgnnLSPVI4oDloEJtMGr0H1uKYuXnFpks.apk

APK SHA-256: `3C7A0507287D2C4531BA27479C5367247F78E5C878CA005A7DD41ED497CAC5E9`.
