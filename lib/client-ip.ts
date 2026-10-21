/** The caller's address as the hosting platform reports it; null when it isn't (e.g. local development). */
export function clientIp(request: Request) {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();

  return forwarded || request.headers.get('x-real-ip') || null;
}
