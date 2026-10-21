import type { NextConfig } from "next";

const isProduction = process.env.NODE_ENV === "production";

// Where the site may load things from. Everything is our own origin, except the map embedded in the address picker
// (Google Maps) and the address search (OpenStreetMap's Nominatim). Photos are served by our own routes or sent as
// data: URLs; voice notes play from blob: URLs.
// Firebase phone verification (only when it is the chosen provider): Google's reCAPTCHA check and Firebase's sign-in API.
const firebasePhone = process.env.PHONE_VERIFICATION_PROVIDER === "firebase";
const recaptcha = firebasePhone ? " https://www.google.com/recaptcha/ https://www.gstatic.com/recaptcha/" : "";
const firebaseApis = firebasePhone ? " https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://www.googleapis.com" : "";
const firebaseFrames = firebasePhone ? " https://www.google.com/recaptcha/ https://recaptcha.google.com" : "";

const contentSecurityPolicy = [
  "default-src 'self'",
  // Next.js puts small inline scripts in every page, so 'unsafe-inline' is needed; nothing from other sites runs.
  `script-src 'self' 'unsafe-inline'${isProduction ? "" : " 'unsafe-eval'"}${recaptcha}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob:${firebasePhone ? " https://www.gstatic.com" : ""}`,
  "media-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self' https://nominatim.openstreetmap.org${firebaseApis}`,
  `frame-src https://maps.google.com https://www.google.com${firebaseFrames}`,
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isProduction ? ["upgrade-insecure-requests"] : []),
].join("; ");

const securityHeaders = [
  // Nobody can put the site inside their own page (clickjacking).
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Only the features the site uses: the customer's/rider's location and the rider's voice notes.
  { key: "Permissions-Policy", value: "geolocation=(self), microphone=(self), camera=(), payment=(), usb=(), bluetooth=(), serial=(), interest-cohort=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
  ...(isProduction
    ? [
        { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
        // The policy above breaks the development server's hot reload, so it is only sent on the live site.
        { key: "Content-Security-Policy", value: contentSecurityPolicy },
      ]
    : []),
];

const nextConfig: NextConfig = {
  // Lets a test build live next to the development server (NEXT_DIST_DIR=.next-prod); normally unused.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Don't announce which framework the site runs on.
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // Browsers must always see the newest push worker.
      { source: "/push-sw.js", headers: [{ key: "Cache-Control", value: "no-cache" }, { key: "Service-Worker-Allowed", value: "/" }] },
    ];
  },
};

export default nextConfig;
