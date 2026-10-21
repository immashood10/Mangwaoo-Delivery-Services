import { NextResponse, type NextRequest } from 'next/server';

// Runs before every API request. A browser that is tricked into calling this site from another website (CSRF) is
// refused: requests that change something must come from this site itself. The session cookie is also SameSite=Lax,
// so this is a second lock on the same door. Tools without a browser (no Origin / Sec-Fetch-Site) are not affected;
// they have no cookie to abuse.

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function proxy(request: NextRequest) {
  if (SAFE_METHODS.has(request.method)) {
    return NextResponse.next();
  }

  const fetchSite = request.headers.get('sec-fetch-site');
  const origin = request.headers.get('origin');
  const host = request.headers.get('host');

  let crossSite = false;

  if (fetchSite) {
    // 'none' is the person typing the address themselves; same-origin is this site's own pages.
    crossSite = fetchSite !== 'same-origin' && fetchSite !== 'none';
  } else if (origin && host) {
    try {
      crossSite = new URL(origin).host !== host;
    } catch {
      crossSite = true;
    }
  }

  if (crossSite) {
    return NextResponse.json({ error: 'This request was blocked because it came from another website.' }, { status: 403 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/api/:path*',
};
