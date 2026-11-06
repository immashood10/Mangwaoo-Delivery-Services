declare const process: { env: { EXPO_PUBLIC_API_URL?: string; NODE_ENV?: string } };
// Public website origin only. Never put database credentials in Expo variables.
const configured = (process.env.EXPO_PUBLIC_API_URL || 'https://mangwaoo.vercel.app').trim();
const parsed = new URL(configured);
if (parsed.protocol !== 'https:' && !(process.env.NODE_ENV !== 'production' && parsed.protocol === 'http:')) {
  throw new Error('EXPO_PUBLIC_API_URL must use HTTPS (HTTP is allowed only for local development).');
}
export const SITE_URL = parsed.origin;
export const TABS = [
  { id: 'food', label: 'Food', icon: '🍔', path: '/' },
  { id: 'shopping', label: 'Shopping', icon: '🛍️', path: '/shopping' },
  { id: 'mart', label: 'Mart', icon: '🛒', path: '/mart' },
  { id: 'reels', label: 'Reels', icon: '▶', path: '/reels' },
  { id: 'orders', label: 'Orders', icon: '📦', path: '/account' },
  { id: 'account', label: 'Account', icon: '👤', path: '/account/settings' },
] as const;
export function isSiteUrl(value: string) {
  try { return new URL(value).origin === SITE_URL; } catch { return false; }
}
export function externalUrlAllowed(value: string) {
  try { return ['https:', 'http:', 'tel:', 'mailto:', 'whatsapp:', 'geo:'].includes(new URL(value).protocol); } catch { return false; }
}
export function pageInfo(value: string) {
  const path = new URL(value, SITE_URL).pathname;
  const within = (root: string) => path === root || path.startsWith(`${root}/`);
  const dashboard = ['/admin', '/seller', '/asm'].some(within) || (within('/rider') && !within('/rider/signup'));
  const tab = path === '/' ? 'food' : within('/shopping') ? 'shopping' : within('/reels') ? 'reels' : within('/gulplaza') || within('/restaurant') ? 'food'
    : within('/mart') || within('/store') ? 'mart'
    : ['/account/settings', '/login', '/signup', '/account/monthly-rider', '/account/points', '/account/loyalty-card'].some(within) ? 'account'
    : ['/account', '/track', '/finding-rider'].some(within) ? 'orders' : null;
  return { dashboard, tab };
}
