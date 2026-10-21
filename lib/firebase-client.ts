// Browser side of the Firebase phone verification: asks Firebase to text a code and turns the typed code into a Firebase
// ID token that the server then checks (lib/firebase-phone.ts). Only the authentication part of Firebase is loaded (and
// only when a code screen opens), and Firebase is told to keep its state in memory: nothing is written to
// localStorage, sessionStorage or IndexedDB.

import type { Auth } from '@firebase/auth';

let authPromise: Promise<Auth> | undefined;

/**
 * Firebase keeps a small "heartbeat" record in the browser's IndexedDB. This site keeps nothing in the browser, so
 * IndexedDB is hidden from the page before Firebase loads (it falls back to memory). The site itself never uses it.
 */
function keepFirebaseOutOfBrowserStorage() {
  try {
    Object.defineProperty(window, 'indexedDB', { value: undefined, configurable: true });
  } catch {
    // Already replaced.
  }
}

async function getFirebaseAuth(): Promise<Auth> {
  authPromise ??= (async () => {
    keepFirebaseOutOfBrowserStorage();

    const [{ getApp, getApps, initializeApp }, { connectAuthEmulator, getAuth, inMemoryPersistence, initializeAuth }] = await Promise.all([
      import('@firebase/app'),
      import('@firebase/auth'),
    ]);

    const app = getApps().length
      ? getApp()
      : initializeApp({
          apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
          authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
          projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
          appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
        });

    let auth: Auth;

    try {
      auth = initializeAuth(app, { persistence: inMemoryPersistence });
    } catch {
      // Already set up (a hot reload of this module in development).
      auth = getAuth(app);
    }

    // Local testing against the Firebase Auth emulator (`firebase emulators:start --only auth`); never set on the live site.
    const emulatorUrl = process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_URL;

    if (emulatorUrl) {
      try {
        connectAuthEmulator(auth, emulatorUrl, { disableWarnings: true });
        // The emulator does not check reCAPTCHA, so the check is switched off for it.
        auth.settings.appVerificationDisabledForTesting = true;
      } catch {
        // Already connected.
      }
    }

    return auth;
  })();

  return authPromise;
}

export type FirebaseSms = {
  /** Checks the typed code with Firebase and returns the ID token that proves the number. */
  confirm: (code: string) => Promise<string>;
};

/** Asks Firebase to text a code to `phoneNumber` (E.164). `container` hosts Google's invisible reCAPTCHA check. */
export async function sendFirebaseSms(phoneNumber: string, container: HTMLElement): Promise<FirebaseSms> {
  const auth = await getFirebaseAuth();
  const { RecaptchaVerifier, signInWithPhoneNumber } = await import('@firebase/auth');

  const verifier = new RecaptchaVerifier(auth, container, { size: 'invisible' });

  try {
    const confirmation = await signInWithPhoneNumber(auth, phoneNumber, verifier);

    return {
      confirm: async (code: string) => {
        const credential = await confirmation.confirm(code);
        const idToken = await credential.user.getIdToken();

        // Firebase's own "signed in" state is not used for anything here: the site's login is its own cookie.
        await auth.signOut().catch(() => undefined);
        verifier.clear();

        return idToken;
      },
    };
  } catch (error) {
    verifier.clear();
    throw error;
  }
}

/** A message a person can act on, for an error thrown by Firebase. */
export function firebaseErrorMessage(error: unknown): string {
  const code = (error as { code?: string } | null)?.code ?? '';

  switch (code) {
    case 'auth/invalid-phone-number':
      return 'That phone number is not valid. Please check it and try again.';
    case 'auth/missing-phone-number':
      return 'Please enter a phone number.';
    case 'auth/too-many-requests':
    case 'auth/quota-exceeded':
      return 'Too many attempts. Please wait a while and try again.';
    case 'auth/invalid-verification-code':
    case 'auth/missing-verification-code':
      return "That code isn't right. Please check the SMS and try again.";
    case 'auth/code-expired':
    case 'auth/session-expired':
      return 'This code has expired. Tap “Resend code” to get a new one.';
    case 'auth/captcha-check-failed':
    case 'auth/invalid-app-credential':
      return 'We could not check that you are not a robot. Please reload the page and try again.';
    case 'auth/network-request-failed':
      return 'Could not reach the server. Please check your internet and try again.';
    case 'auth/operation-not-allowed':
    case 'auth/billing-not-enabled':
    case 'auth/app-not-authorized':
    case 'auth/unauthorized-domain':
      return 'SMS verification is not available right now. Please try again later.';
    default:
      return 'We could not send the SMS code. Please try again.';
  }
}
