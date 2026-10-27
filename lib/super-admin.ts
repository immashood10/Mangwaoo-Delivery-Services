// The super admin is an ordinary ADMIN account whose login name is "superadmin" (the `email` column holds it, like the
// admin's "mangwaooadmin"). It can do everything an admin can, and additionally gets the Super Overview page
// (/admin/super). No database change is needed for this; nobody else can open that page.

export const SUPERADMIN_LOGIN = 'superadmin';

export function isSuperAdminLogin(email: string | null | undefined) {
  return (email ?? '').trim().toLowerCase() === SUPERADMIN_LOGIN;
}
