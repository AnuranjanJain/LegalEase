export const JURISDICTIONS = {
  GENERAL: "General / Not Specified",
  CALIFORNIA: "California Law",
  NEW_YORK: "New York Law",
  DELAWARE: "Delaware Corporate Law",
  INDIA: "Indian Contract Act",
  UK: "United Kingdom Law",
  EU: "European Union Law",
} as const;

export type Jurisdiction = typeof JURISDICTIONS[keyof typeof JURISDICTIONS];
