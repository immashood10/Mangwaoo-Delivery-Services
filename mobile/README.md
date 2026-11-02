# Mangwaoo Mobile

Expo React Native client for Android and iOS. It uses the same Mangwaoo API and database as the website: website checkouts and mobile checkouts enter the same dispatch, and rider requests include orders from both channels. No separate Firebase database is created because that would split the account and order data.

## Run

1. Install Node.js 22.13+ and the current Expo Go app (SDK 58), or use an Android/iOS development build.
2. From `mobile/`, run `npm install` then `npm start`.
3. Scan the QR code with Expo Go. For a local API, create `mobile/.env` with `EXPO_PUBLIC_API_URL=http://YOUR_COMPUTER_LAN_IP:3000` and run the website server on that address. For production, the default is `https://mangwaoo.vercel.app`.

The native app signs in through the website's existing login API. Keep login, rider chat and checkout requests on the same API origin so the platform session cookie is reused. Rider availability and GPS require foreground location permission. Rider requests refresh every five seconds, matching the current rider dispatch API.

## Current app scope

- Shared customer/rider sign-in.
- Customer product catalog, cart and cash-on-delivery checkout. Checkout opens the same rider order chat used by website checkout.
- Rider online/offline, wallet hold status, nearby requests, accept and complete delivery.
- Public catalog feed at `GET /api/mobile/catalog`; checkout revalidates product availability and prices on the server.

Firebase phone verification is already part of the website's account system. The app keeps the website API as the authority so the same login and orders work across platforms. Add Firebase Cloud Messaging later if native push delivery is needed; the current web push subscription is browser-specific.

For store releases, set up an Expo EAS project, app-store signing credentials, privacy policy, support contact, and production API URL before building submissions.

Build commands after `eas login` and `eas init`:

```sh
npx eas build --platform android --profile production
npx eas build --platform ios --profile production
```
