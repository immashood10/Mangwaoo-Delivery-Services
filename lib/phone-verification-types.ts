// Shared by the code screen in the browser and the verification API routes.

export const CODE_LENGTH = 6;

/**
 * What the browser needs to show the "enter the code" screen. `ticket` is an opaque secret held only in React
 * state while the screen is open; `phone` is already masked. `devCode` exists only in local test mode, while
 * WhatsApp is not connected (the code is then shown on screen because no message is sent).
 */
export type PhoneVerificationInfo = {
  ticket: string;
  phone: string;
  /** Seconds before another code may be requested. */
  retryAfter: number;
  devCode?: string;
};

export type VerifiedUser = {
  id: string;
  name: string;
  email: string;
  role: 'CUSTOMER' | 'SELLER' | 'RIDER' | 'ADMIN';
  phone: string | null;
};
