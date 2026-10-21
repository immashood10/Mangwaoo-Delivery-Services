// Phone numbers on Mangwaoo are Pakistani mobile numbers: that is what WhatsApp codes are sent to.

/**
 * "0300-1234567", "+92 300 1234567" or "923001234567" all become "923001234567" (the form WhatsApp wants).
 * Returns null when the text is not a Pakistani mobile number.
 */
export function normalizePakistaniMobile(input: string): string | null {
  let digits = input.replace(/\D/g, '');

  if (digits.startsWith('0092')) digits = digits.slice(2);
  if (digits.length === 13 && digits.startsWith('920')) digits = `92${digits.slice(3)}`;
  if (digits.length === 11 && digits.startsWith('03')) digits = `92${digits.slice(1)}`;
  if (digits.length === 10 && digits.startsWith('3')) digits = `92${digits}`;

  return /^923\d{9}$/.test(digits) ? digits : null;
}

/** The way a number is stored on an account: 03001234567. */
export function toLocalPhone(whatsappNumber: string) {
  return `0${whatsappNumber.slice(2)}`;
}

/** "+92 ••• ••• 4567": enough for people to recognise their own number without printing all of it. */
export function maskPhone(whatsappNumber: string) {
  return `+92 ••• ••• ${whatsappNumber.slice(-4)}`;
}
