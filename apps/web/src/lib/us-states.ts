/**
 * US states + DC, with their USPS codes (#76).
 *
 * ONE list, two consumers: the digest form's state picker (which stores the full NAME as a Brevo
 * attribute) and the competition card's region label (which renders the CODE). Keeping them on the
 * same array is the point — a second hand-written list of states is how "Texas" and "TX" drift
 * apart or how a state silently loses its abbreviation.
 *
 * ⚠ This duplicates data the API already holds: `Region` carries a `code` and a `level`, but the
 * public `CompetitionSummary.regions` is a flat `string[]` of NAMES, so the web has neither. The
 * fix — `RegionRef {name, code?, level}` on that DTO, after which everything here except
 * `US_STATES` (still needed for the digest picker) is deleted — is planned in
 * `docs/sweep-remediation-plan.md` §12, batched with §15's summary fields. See
 * catalog-display.regionLabel for the heuristics this forces in the meantime.
 */
export const US_STATES: readonly { name: string; code: string }[] = [
  { name: 'Alabama', code: 'AL' },
  { name: 'Alaska', code: 'AK' },
  { name: 'Arizona', code: 'AZ' },
  { name: 'Arkansas', code: 'AR' },
  { name: 'California', code: 'CA' },
  { name: 'Colorado', code: 'CO' },
  { name: 'Connecticut', code: 'CT' },
  { name: 'Delaware', code: 'DE' },
  { name: 'District of Columbia', code: 'DC' },
  { name: 'Florida', code: 'FL' },
  { name: 'Georgia', code: 'GA' },
  { name: 'Hawaii', code: 'HI' },
  { name: 'Idaho', code: 'ID' },
  { name: 'Illinois', code: 'IL' },
  { name: 'Indiana', code: 'IN' },
  { name: 'Iowa', code: 'IA' },
  { name: 'Kansas', code: 'KS' },
  { name: 'Kentucky', code: 'KY' },
  { name: 'Louisiana', code: 'LA' },
  { name: 'Maine', code: 'ME' },
  { name: 'Maryland', code: 'MD' },
  { name: 'Massachusetts', code: 'MA' },
  { name: 'Michigan', code: 'MI' },
  { name: 'Minnesota', code: 'MN' },
  { name: 'Mississippi', code: 'MS' },
  { name: 'Missouri', code: 'MO' },
  { name: 'Montana', code: 'MT' },
  { name: 'Nebraska', code: 'NE' },
  { name: 'Nevada', code: 'NV' },
  { name: 'New Hampshire', code: 'NH' },
  { name: 'New Jersey', code: 'NJ' },
  { name: 'New Mexico', code: 'NM' },
  { name: 'New York', code: 'NY' },
  { name: 'North Carolina', code: 'NC' },
  { name: 'North Dakota', code: 'ND' },
  { name: 'Ohio', code: 'OH' },
  { name: 'Oklahoma', code: 'OK' },
  { name: 'Oregon', code: 'OR' },
  { name: 'Pennsylvania', code: 'PA' },
  { name: 'Rhode Island', code: 'RI' },
  { name: 'South Carolina', code: 'SC' },
  { name: 'South Dakota', code: 'SD' },
  { name: 'Tennessee', code: 'TN' },
  { name: 'Texas', code: 'TX' },
  { name: 'Utah', code: 'UT' },
  { name: 'Vermont', code: 'VT' },
  { name: 'Virginia', code: 'VA' },
  { name: 'Washington', code: 'WA' },
  { name: 'West Virginia', code: 'WV' },
  { name: 'Wisconsin', code: 'WI' },
  { name: 'Wyoming', code: 'WY' },
];

const CODE_BY_NAME = new Map(US_STATES.map((s) => [s.name.toLowerCase(), s.code]));

/** "Texas" → "TX". undefined for anything that is not a US state (country, region, city). */
export function stateCode(regionName: string): string | undefined {
  return CODE_BY_NAME.get(regionName.trim().toLowerCase());
}

/**
 * The country tags a US-only catalog produces. Matched by name because the public
 * CompetitionSummary sends no region `level` — the moment that DTO carries level, switch this to
 * `level === 'country'` and drop the list.
 */
const US_COUNTRY_NAMES = new Set(['united states', 'united states of america', 'usa', 'us']);

export function isUsCountry(regionName: string): boolean {
  return US_COUNTRY_NAMES.has(regionName.trim().toLowerCase());
}

/**
 * The seeded `VIRTUAL`-level region is named "Virtual / Online" (Liquibase 0010) — accurate as a
 * data label, too long for a card slot next to a two-letter state code. Shortened for display only;
 * the stored name is untouched.
 *
 * ⚠ This is the REGION-level "online", i.e. *where* an edition takes place. It is distinct from the
 * competition's `delivery` facet (in_person | virtual | hybrid), which is *how* it runs. A hybrid
 * competition can be delivery=hybrid while carrying real state regions — the two must not be
 * conflated, and this helper deliberately only touches the region.
 */
export function displayRegionName(regionName: string): string {
  return /^virtual\s*\/\s*online$/i.test(regionName.trim()) ? 'Online' : regionName;
}
