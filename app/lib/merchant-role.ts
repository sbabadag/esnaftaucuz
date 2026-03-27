/**
 * Esnaf rolü: yalnızca açık is_merchant veya aktif benzeri abonelik durumu.
 * Sadece merchant_subscription_plan dolu olması (iptal/yarım kayıt) esnaf sayılmamalı.
 */
function normalizeMerchantFlag(value: unknown): boolean {
  if (value === true) return true;
  if (value === false || value == null) return false;
  if (typeof value === 'string') {
    const n = value.trim().toLowerCase();
    return n === 'true' || n === 't' || n === '1';
  }
  if (typeof value === 'number') return value === 1;
  return false;
}

export function resolveMerchantRoleFromProfile(profile: any): boolean {
  if (!profile) return false;
  if (normalizeMerchantFlag(profile.is_merchant)) return true;
  const status = String(profile.merchant_subscription_status || '').toLowerCase();
  return status === 'active' || status === 'past_due' || status === 'trialing';
}
