import type { JerseyFields, JerseyLogoPlacementValue } from '@/lib/jersey-config';

export type JerseyPreviewSponsor = {
  name: string;
  placement: JerseyLogoPlacementValue;
  imageDataUrl: string;
};

const SHORT_SHIRT = 'M174 80 L216 53 Q240 75 264 53 L306 80 L385 126 L349 198 L317 181 L317 510 Q240 536 163 510 L163 181 L131 198 L95 126 Z';
const LONG_SHIRT = 'M174 80 L216 53 Q240 75 264 53 L306 80 L385 126 L402 260 L356 269 L335 183 L317 187 L317 510 Q240 536 163 510 L163 187 L145 183 L124 269 L78 260 L95 126 L131 198 Z';

function escapeXml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[character]!);
}

function patternOverlay(pattern: JerseyFields['pattern'], color: string, shape: string) {
  if (pattern === 'SOLID') return '';
  const path = pattern === 'STRIPES'
    ? '<path d="M18 0V120 M58 0V120 M98 0V120" stroke="COLOR" stroke-width="13" opacity=".48"/>'
    : pattern === 'DIAGONAL'
      ? '<path d="M-30 30L30-30 M0 100L100 0 M70 130L130 70" stroke="COLOR" stroke-width="16" opacity=".42"/>'
      : pattern === 'CHEVRON'
        ? '<path d="M0 20L50 55L100 20 M0 75L50 110L100 75" fill="none" stroke="COLOR" stroke-width="12" opacity=".45"/>'
        : pattern === 'GEOMETRIC'
          ? '<path d="M50 5L94 30L94 80L50 105L6 80L6 30Z M50 25L76 40L76 70L50 85L24 70L24 40Z" fill="none" stroke="COLOR" stroke-width="7" opacity=".48"/>'
          : '<path d="M16 25Q28 5 48 22T82 22Q95 35 76 48T42 49Q19 55 16 25ZM5 88Q18 65 39 83T74 83Q96 99 72 112T36 109Q12 116 5 88Z" fill="COLOR" opacity=".35"/>';
  return `<pattern id="accentPattern" width="100" height="120" patternUnits="userSpaceOnUse">${path.replaceAll('COLOR', color)}</pattern><path d="${shape}" fill="url(#accentPattern)"/>`;
}

function collarMarkup(collar: JerseyFields['collar'], primary: string, secondary: string) {
  if (collar === 'V_NECK') {
    return `<path d="M216 54 Q240 77 264 54 L240 112 Z" fill="${primary}" stroke="${secondary}" stroke-width="7"/><path d="M216 54 L240 112 L264 54" fill="none" stroke="#ffffff" stroke-opacity=".8" stroke-width="3"/>`;
  }
  if (collar === 'POLO') {
    return `<path d="M216 54 Q240 77 264 54 L276 88 L240 120 L204 88 Z" fill="${secondary}"/><path d="M216 54 L240 89 L264 54" fill="${primary}" stroke="#ffffff" stroke-opacity=".65" stroke-width="3"/><path d="M240 89V116" stroke="#ffffff" stroke-opacity=".8" stroke-width="3"/>`;
  }
  return `<path d="M216 54 Q240 81 264 54 L258 76 Q240 97 222 76 Z" fill="${secondary}" stroke="#ffffff" stroke-opacity=".65" stroke-width="3"/>`;
}

function sponsorMarkup(sponsors: JerseyPreviewSponsor[], side: 'front' | 'back') {
  const positions: Record<JerseyLogoPlacementValue, { x: number; y: number; width: number; height: number; sides: ('front' | 'back')[] }> = {
    FRONT_CHEST: { x: 200, y: 220, width: 80, height: 56, sides: ['front'] },
    LEFT_SLEEVE: { x: 101, y: 143, width: 58, height: 42, sides: ['front'] },
    RIGHT_SLEEVE: { x: 321, y: 143, width: 58, height: 42, sides: ['front'] },
    UPPER_BACK: { x: 198, y: 126, width: 84, height: 52, sides: ['back'] },
    LOWER_BACK: { x: 202, y: 433, width: 76, height: 48, sides: ['back'] },
  };
  return sponsors.flatMap((sponsor, index) => {
    const position = positions[sponsor.placement];
    if (!position.sides.includes(side)) return [];
    const label = escapeXml(sponsor.name || `Sponsor ${index + 1}`);
    const href = escapeXml(sponsor.imageDataUrl);
    return [`<image href="${href}" x="${position.x}" y="${position.y}" width="${position.width}" height="${position.height}" preserveAspectRatio="xMidYMid meet" aria-label="${label}"/>`];
  }).join('');
}

/** A vector jersey preview with exact customer text and unmodified sponsor logo files over the generated fabric texture. */
export function jerseyPreviewSvg(fields: JerseyFields, fabricDataUrl: string, sponsors: JerseyPreviewSponsor[], side: 'front' | 'back') {
  const shape = fields.sleeve === 'LONG' ? LONG_SHIRT : SHORT_SHIRT;
  const textureOpacity = fields.pattern === 'SOLID' ? 0.28 : 0.64;
  const text = (label: string, x: number, y: number, size: number, weight = 800) =>
    `<text x="${x}" y="${y}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="${size}" font-weight="${weight}" letter-spacing="1.5" fill="#fff" stroke="${fields.primaryColor}" stroke-width="4" paint-order="stroke" stroke-linejoin="round">${escapeXml(label)}</text>`;
  const backText = side === 'back'
    ? `${text(fields.playerName.toUpperCase(), 240, 204, Math.max(19, Math.min(30, 470 / fields.playerName.length)), 900)}${text(String(fields.jerseyNumber), 240, 340, 116, 900)}`
    : `${text(fields.teamName.toUpperCase(), 240, 205, Math.max(15, Math.min(24, 420 / fields.teamName.length)), 800)}${text(String(fields.jerseyNumber), 315, 270, 44, 900)}`;
  const seamColor = fields.secondaryColor;
  const sleeveCuff = fields.sleeve === 'LONG'
    ? `<path d="M82 241L125 248 M355 248L398 241" stroke="${seamColor}" stroke-width="10"/>`
    : `<path d="M101 143L131 158 M349 158L379 143" stroke="${seamColor}" stroke-width="8"/>`;
  const source = escapeXml(fabricDataUrl);

  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="480" height="560" viewBox="0 0 480 560" role="img" aria-label="${side} view of ${escapeXml(fields.teamName)} custom jersey">
    <defs><clipPath id="shirtClip"><path d="${shape}"/></clipPath><pattern id="fabric" width="190" height="190" patternUnits="userSpaceOnUse"><image href="${source}" x="0" y="0" width="190" height="190" preserveAspectRatio="xMidYMid slice"/></pattern></defs>
    <ellipse cx="240" cy="526" rx="126" ry="15" fill="#101828" opacity=".12"/>
    <path d="${shape}" fill="${fields.primaryColor}" stroke="#101828" stroke-opacity=".23" stroke-width="5" stroke-linejoin="round"/>
    <image href="${source}" x="78" y="45" width="324" height="490" preserveAspectRatio="xMidYMid slice" opacity="${textureOpacity}" clip-path="url(#shirtClip)"/>
    ${patternOverlay(fields.pattern, seamColor, shape)}
    <g clip-path="url(#shirtClip)" fill="none" stroke="#fff" stroke-opacity=".28" stroke-width="2"><path d="M163 180V506Q240 528 317 506V180"/><path d="M131 198L163 181 M349 198L317 181"/></g>
    ${sleeveCuff}
    ${collarMarkup(fields.collar, fields.primaryColor, seamColor)}
    ${backText}
    ${sponsorMarkup(sponsors, side)}
  </svg>`;
}

export function jerseySvgDataUrl(svg: string) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
