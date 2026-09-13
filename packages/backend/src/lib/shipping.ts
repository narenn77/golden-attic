// USPS shipping rate estimation.
//
// TODO: this is a flat weight-band ESTIMATE, not a live USPS rate lookup.
// Real USPS rates depend on origin/destination shipping zone (distance
// between ZIP codes), which requires either the USPS Web Tools API or the
// newer USPS APIs (both need a registered USPS account/API key - see
// DEPLOYMENT.md for where to get one). Once USPS_API_KEY is set, swap the
// body of calculateShippingRate for a real API call using the same
// input/output shape so nothing else in the app needs to change.
//
// The bands below are a rough approximation of real First-Class Package /
// Priority Mail retail rates for small parcels, intended to make checkout
// functionally testable before a real API key is configured - NOT accurate
// pricing to charge real customers.

const DEFAULT_WEIGHT_OZ = 16; // assume 1lb if a listing has no weight set

export interface ShippingRateResult {
  cost: number;
  service: string;
  estimated: true; // always true until real USPS API integration lands
}

export function calculateShippingRate(weightOz: number | null | undefined): ShippingRateResult {
  const weight = weightOz && weightOz > 0 ? weightOz : DEFAULT_WEIGHT_OZ;

  if (weight <= 4) return { cost: 4.5, service: 'USPS First-Class Package (est.)', estimated: true };
  if (weight <= 8) return { cost: 6.0, service: 'USPS First-Class Package (est.)', estimated: true };
  if (weight <= 16) return { cost: 8.5, service: 'USPS Priority Mail (est.)', estimated: true };
  if (weight <= 32) return { cost: 11.0, service: 'USPS Priority Mail (est.)', estimated: true };
  if (weight <= 48) return { cost: 13.5, service: 'USPS Priority Mail (est.)', estimated: true };
  if (weight <= 80) return { cost: 16.0, service: 'USPS Priority Mail (est.)', estimated: true };

  // Beyond 5lb, add a rough per-pound increment rather than a hard cutoff.
  const extraPounds = Math.ceil((weight - 80) / 16);
  return { cost: 16.0 + extraPounds * 1.5, service: 'USPS Priority Mail (est.)', estimated: true };
}

/** Rough same-area check for offering local pickup as an alternative to
 * shipping - matches on city+state (case-insensitive) or a shared 3-digit
 * ZIP prefix (ZIP codes sharing the first 3 digits are usually within the
 * same metro/regional area). Not precise, just enough to surface the
 * option when it's plausibly convenient. */
export function isLikelyLocalPickup(
  a: { city?: string | null; state?: string | null; postalCode?: string | null },
  b: { city?: string | null; state?: string | null; postalCode?: string | null }
): boolean {
  if (a.city && a.state && b.city && b.state) {
    if (a.city.trim().toLowerCase() === b.city.trim().toLowerCase() && a.state.trim().toLowerCase() === b.state.trim().toLowerCase()) {
      return true;
    }
  }
  if (a.postalCode && b.postalCode && a.postalCode.length >= 3 && b.postalCode.length >= 3) {
    if (a.postalCode.slice(0, 3) === b.postalCode.slice(0, 3)) return true;
  }
  return false;
}
