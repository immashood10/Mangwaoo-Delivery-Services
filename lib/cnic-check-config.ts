// Small and free of the AI library, so server pages can ask "is the automatic CNIC photo check on?" without loading it.

/**
 * The model that looks at the pictures. Claude Haiku 5.5 (`claude-haiku-5-5`) is far cheaper and quicker if the owner
 * prefers that: set CNIC_CHECK_MODEL on the host.
 */
export const DEFAULT_CNIC_CHECK_MODEL = 'claude-opus-5-5';

export function cnicCheckModel() {
  return process.env.CNIC_CHECK_MODEL?.trim() || DEFAULT_CNIC_CHECK_MODEL;
}

/** The check is on when the host has an Anthropic API key. Without one riders sign up exactly as they did before. */
export function cnicCheckEnabled() {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}
