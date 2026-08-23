const WHATSAPP_API_VERSION = 'v21.0';

function messagesUrl(phoneNumberId: string) {
  return `https://graph.facebook.com/${WHATSAPP_API_VERSION}/${phoneNumberId}/messages`;
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
 * Requires WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_ACCESS_TOKEN. Returns
 * whether the send succeeded so callers can decide how to react.
 */
export async function sendWhatsAppTemplate(
  to: string,
  templateName: string,
  bodyParams: string[]
): Promise<boolean> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

  if (!phoneNumberId || !accessToken) {
    console.warn(
      'WhatsApp template send skipped: set WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_ACCESS_TOKEN to enable it.'
    );
    return false;
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
        to,
        type: 'template',
        template: {
          name: templateName,
          language: { code: 'en' },
          ...(bodyParams.length > 0
            ? { components: [{ type: 'body', parameters: bodyParams.map((text) => ({ type: 'text', text })) }] }
            : {}),
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
