import { createRemoteJWKSet, decodeJwt, jwtVerify } from 'jose';

// Phone verification through Firebase Authentication. The browser asks Firebase to text a code to the number (with
// Google's reCAPTCHA in front) and Firebase answers with an ID token once the right code is typed. The server never
// trusts the browser's word: it checks that token's signature with Google's public keys (no secret key is needed),
// that it was issued for THIS project, by a phone sign-in, a moment ago, and that it is for the number being verified.

const GOOGLE_KEYS_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
const MAX_TOKEN_AGE_SECONDS = 10 * 60;

/** Which provider sends the codes: "firebase" (SMS) or the default "whatsapp". */
export function usesFirebasePhone() {
  return process.env.PHONE_VERIFICATION_PROVIDER === 'firebase';
}

export function firebaseProjectId() {
  return process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim() || '';
}

// Reused between requests: the library caches Google's keys.
let keys: ReturnType<typeof createRemoteJWKSet> | undefined;

function googleKeys() {
  keys ??= createRemoteJWKSet(new URL(process.env.FIREBASE_JWKS_URL || GOOGLE_KEYS_URL));
  return keys;
}

/** The Firebase Auth emulator (local testing only) signs nothing, so its tokens can't be checked against Google's keys. */
function emulatorInUse() {
  return process.env.NODE_ENV !== 'production' && Boolean(process.env.FIREBASE_AUTH_EMULATOR_HOST);
}

export type FirebasePhoneResult = { ok: true; phone: string } | { ok: false; reason: string };

/** Checks a Firebase ID token and returns the phone number it proves (E.164, e.g. +923001234567). */
export async function verifyFirebasePhoneToken(idToken: string): Promise<FirebasePhoneResult> {
  const projectId = firebaseProjectId();

  if (!projectId) {
    return { ok: false, reason: 'Phone verification is not set up.' };
  }

  if (idToken.length > 4000) {
    return { ok: false, reason: 'Invalid token.' };
  }

  try {
    const payload = emulatorInUse()
      ? decodeJwt(idToken)
      : (
          await jwtVerify(idToken, googleKeys(), {
            issuer: `https://securetoken.google.com/${projectId}`,
            audience: projectId,
            algorithms: ['RS256'],
          })
        ).payload;

    const firebase = payload.firebase as { sign_in_provider?: string } | undefined;
    const phone = typeof payload.phone_number === 'string' ? payload.phone_number : '';
    const authTime = typeof payload.auth_time === 'number' ? payload.auth_time : 0;

    if (emulatorInUse() && (payload.aud !== projectId || payload.iss !== `https://securetoken.google.com/${projectId}`)) {
      return { ok: false, reason: 'This token is for another project.' };
    }

    if (firebase?.sign_in_provider !== 'phone' || !/^\+\d{8,15}$/.test(phone)) {
      return { ok: false, reason: 'This token does not prove a phone number.' };
    }

    if (Math.floor(Date.now() / 1000) - authTime > MAX_TOKEN_AGE_SECONDS) {
      return { ok: false, reason: 'This code was entered too long ago. Please verify again.' };
    }

    return { ok: true, phone };
  } catch {
    return { ok: false, reason: 'We could not confirm your phone number. Please try again.' };
  }
}
