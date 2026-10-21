// What a new password has to look like. Shared by the sign-up, reset and change-password routes (the forms show the
// same minimum). Existing accounts keep logging in with the password they have; the rule applies when one is set.

export const MIN_PASSWORD_LENGTH = 8;
// bcrypt only reads the first 72 bytes, so anything longer would be silently cut.
export const MAX_PASSWORD_BYTES = 72;

const COMMON_PASSWORDS = new Set([
  '12345678',
  '123456789',
  '1234567890',
  '11111111',
  '00000000',
  '87654321',
  'password',
  'password1',
  'password123',
  'passw0rd',
  'qwertyui',
  'qwerty123',
  'qwertyuiop',
  'iloveyou',
  'abc12345',
  'abcd1234',
  'admin123',
  'welcome1',
  'letmein1',
  'mangwaoo',
  'mangwaoo123',
  'pakistan',
  'pakistan123',
  'karachi123',
]);

/** Why this password can't be used (shown to the person), or null when it is fine. */
export function passwordProblem(password: string, personalInfo: string[] = []): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Your password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }

  if (Buffer.byteLength(password, 'utf8') > MAX_PASSWORD_BYTES) {
    return 'Your password is too long. Please use at most 72 characters.';
  }

  const lowered = password.toLowerCase();

  if (COMMON_PASSWORDS.has(lowered) || /^(.)\1+$/.test(password)) {
    return 'That password is too easy to guess. Please choose a different one.';
  }

  for (const info of personalInfo) {
    const value = info.trim().toLowerCase();

    if (value.length >= 4 && lowered === value) {
      return 'Your password must not be the same as your email or name.';
    }
  }

  return null;
}
