/**
 * Site-wide configuration constants.
 * Centralize all contact info, branding, and environment values here.
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
} as const;
