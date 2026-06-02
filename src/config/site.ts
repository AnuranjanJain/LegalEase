/**
 * Site-wide configuration constants.
 *
 * Centralize all contact info, branding, and environment values here.
 *
 * Update LEGAL_LAST_UPDATED whenever Privacy Policy or Terms of Service
 * content is modified so the displayed revision date stays accurate.
 */

export const siteConfig = {
  /** Primary privacy / DPO contact email */
  contactEmail: 'privacy@legalease.io',

  /** Security team contact email */
  securityEmail: 'security@legalease.io',

  /** Legal team contact email */
  legalEmail: 'legal@legalease.io',

  /** Public-facing app name */
  appName: 'LegalEase',

  /** Company or org name */
  orgName: 'LegalEase',

  /** ISO date string displayed as "Last updated" on legal pages. */
  legalLastUpdated: "2026-05-22",
} as const;

/**
 * Formats an ISO date string (YYYY-MM-DD) into a human-readable form.
 * Example: "May 22, 2026"
 */
export function formatLegalDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
