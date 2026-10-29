'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

const DASHBOARD_ROOTS = ['/admin', '/seller', '/rider', '/asm'];
// Public pages that live under a dashboard path and keep the website's navbar and footer.
const PUBLIC_PAGES = ['/rider/signup'];

/** Renders the public site chrome (navbar/footer) everywhere except the admin, seller, rider and area manager dashboards, which have their own sidebar. */
export default function HideOnDashboardRoutes({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isPublic = PUBLIC_PAGES.some((page) => pathname === page || pathname.startsWith(`${page}/`));

  if (!isPublic && DASHBOARD_ROOTS.some((root) => pathname === root || pathname.startsWith(`${root}/`))) {
    return null;
  }

  return children;
}
