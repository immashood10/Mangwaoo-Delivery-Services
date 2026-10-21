'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

const DASHBOARD_ROOTS = ['/admin', '/seller'];

/** Renders the public site chrome (navbar/footer) everywhere except the admin and seller dashboards, which have their own sidebar. */
export default function HideOnDashboardRoutes({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  if (DASHBOARD_ROOTS.some((root) => pathname === root || pathname.startsWith(`${root}/`))) {
    return null;
  }

  return children;
}
