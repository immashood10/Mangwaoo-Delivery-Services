// The address links in messages (password reset) must point at. Taken from the configuration when it is set, so a forged
// Host header on a request can never make a reset link point at someone else's website.

export function siteOrigin(request: Request) {
  const configured = process.env.SITE_URL?.trim();

  if (configured) return configured.replace(/\/+$/, '');

  const vercelHost = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();

  if (process.env.NODE_ENV === 'production' && vercelHost) return `https://${vercelHost}`;

  return new URL(request.url).origin;
}
