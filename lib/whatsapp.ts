const WHATSAPP_API_VERSION = 'v21.0';

function messagesUrl(phoneNumberId: string) {
  // WHATSAPP_API_BASE_URL only exists so a test or staging stand-in can take Meta's place.
  const base = (process.env.WHATSAPP_API_BASE_URL || 'https://graph.facebook.com').replace(/\/+$/, '');

  return `${base}/${WHATSAPP_API_VERSION}/${phoneNumberId}/messages`;
}

/** Whether the WhatsApp Business Cloud API credentials are set, i.e. whether messages can really be sent. */
export function isWhatsAppConfigured() {
  return Boolean(process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_ACCESS_TOKEN);
}

/**
 * Sends a WhatsApp message to the store owner's own number via the WhatsApp
 * Business Cloud API. This is a one-way, server-to-owner notification —
 * customers never see or trigger their own WhatsApp client for this.
 *
 * Requires WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_ACCESS_TOKEN, and
 * WHATSAPP_NOTIFY_NUMBER to be set. If any are missing, this silently no-ops
 * so checkout never breaks because of notification config.
 */
export async function sendWhatsAppNotification(message: string) {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const recipient = process.env.WHATSAPP_NOTIFY_NUMBER;

  if (!phoneNumberId || !accessToken || !recipient) {
    console.warn(
      'WhatsApp notification skipped: set WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_ACCESS_TOKEN, and WHATSAPP_NOTIFY_NUMBER to enable it.'
    );
    return;
  }

  try {
    const response = await fetch(messagesUrl(phoneNumberId), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: recipient,
        type: 'text',
        text: { body: message },
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('WhatsApp notification failed:', response.status, errorBody);
    }
  } catch (error) {
    console.error('WhatsApp notification failed:', error);
  }
}

/**
 * Sends a WhatsApp template message to an arbitrary customer's own number
 * (e.g. for password reset links). Unlike sendWhatsAppNotification, this
 * targets a dynamic recipient the business has likely never messaged before,
 * so it's outside any 24h customer-service session — Meta requires a
 * pre-approved message template for that, not freeform text.
 *
 * `templateName` must match a template already approved in the Meta Business
 * dashboard (WhatsApp Manager > Message Templates), with exactly as many
 * {{n}} body variables as `bodyParams` provided, in order.
 *
 * `options.language` is the template's language code (default "en").
 * `options.buttonParams` fills the template's first button — Meta's
 * "Authentication" templates carry the code on a copy-code button too.
 *
 * Requires WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_ACCESS_TOKEN. Returns
 * whether the send succeeded so callers can decide how to react.
 */
export async function sendWhatsAppTemplate(
  to: string,
  templateName: string,
  bodyParams: string[],
  options: { language?: string; buttonParams?: string[] } = {}
): Promise<boolean> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

  if (!phoneNumberId || !accessToken) {
    console.warn(
      'WhatsApp template send skipped: set WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_ACCESS_TOKEN to enable it.'
    );
    return false;
  }

  const components = [
    ...(bodyParams.length > 0
      ? [{ type: 'body', parameters: bodyParams.map((text) => ({ type: 'text', text })) }]
      : []),
    ...(options.buttonParams?.length
      ? [
          {
            type: 'button',
            sub_type: 'url',
            index: '0',
            parameters: options.buttonParams.map((text) => ({ type: 'text', text })),
          },
        ]
      : []),
  ];

  try {
    const response = await fetch(messagesUrl(phoneNumberId), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'template',
        template: {
          name: templateName,
          language: { code: options.language ?? 'en' },
          ...(components.length > 0 ? { components } : {}),
        },
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('WhatsApp template send failed:', response.status, errorBody);
      return false;
    }

    return true;
  } catch (error) {
    console.error('WhatsApp template send failed:', error);
    return false;
  }
}

/**
 * Sends the sign-up / log-in verification code to a number's own WhatsApp
 * (`to` is country-coded digits like "923001234567").
 *
 * Uses a pre-approved template (see WHATSAPP_OTP_TEMPLATE_* in .env.example).
 * By default that is an "Authentication" template, which needs the code in
 * both the body and the copy-code button; set WHATSAPP_OTP_TEMPLATE_KIND=text
 * if the template is a plain text one with a single {{1}} variable instead.
 */
export async function sendWhatsAppCode(to: string, code: string): Promise<boolean> {
  const templateName = process.env.WHATSAPP_OTP_TEMPLATE_NAME || 'verification_code';
  const language = process.env.WHATSAPP_OTP_TEMPLATE_LANGUAGE || 'en';
  const isAuthenticationTemplate = process.env.WHATSAPP_OTP_TEMPLATE_KIND !== 'text';

  return sendWhatsAppTemplate(to, templateName, [code], {
    language,
    ...(isAuthenticationTemplate ? { buttonParams: [code] } : {}),
  });
}

/**
 * Normalizes a locally-entered Pakistani phone number (e.g. "0300-1234567")
 * into the digits-only, country-coded format the WhatsApp API expects
 * (e.g. "923001234567"). Returns null if the input doesn't look like a
 * plausible Pakistani mobile number.
 */
export function normalizeWhatsAppNumber(phone: string): string | null {
  const digits = phone.replace(/\D/g, '');

  if (digits.length === 11 && digits.startsWith('0')) {
    return `92${digits.slice(1)}`;
  }

  if (digits.length === 12 && digits.startsWith('92')) {
    return digits;
  }

  if (digits.length === 10 && digits.startsWith('3')) {
    return `92${digits}`;
  }

  return null;
}
