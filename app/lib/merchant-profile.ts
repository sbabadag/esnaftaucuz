/** Merchant public profile — persisted on public.users columns (+ location JSONB). */

export type MerchantProfileFields = {
  shopName: string;
  logoUrl: string;
  phone: string;
  whatsapp: string;
  address: string;
  city: string;
  district: string;
  description: string;
  openingHours: string;
};

export const emptyMerchantProfile = (): MerchantProfileFields => ({
  shopName: '',
  logoUrl: '',
  phone: '',
  whatsapp: '',
  address: '',
  city: '',
  district: '',
  description: '',
  openingHours: '',
});

function pickString(...values: unknown[]): string {
  for (const value of values) {
    const text = String(value ?? '').trim();
    if (text) return text;
  }
  return '';
}

export function readMerchantProfileFromUser(user: any): MerchantProfileFields {
  const prefs = user?.preferences || {};
  const loc = user?.location || {};
  return {
    shopName: pickString(user?.name),
    logoUrl: pickString(user?.shop_logo, prefs.shopLogo, user?.avatar),
    phone: pickString(user?.shop_phone, prefs.phone),
    whatsapp: pickString(user?.shop_whatsapp, prefs.whatsapp, user?.shop_phone, prefs.phone),
    address: pickString(user?.shop_address, prefs.shopAddress),
    city: pickString(loc.city, prefs.city),
    district: pickString(loc.district, prefs.district),
    description: pickString(user?.shop_description, prefs.shopDescription),
    openingHours: pickString(user?.shop_opening_hours, prefs.openingHours),
  };
}

/** Column payload for users PATCH (database columns). */
export function merchantProfileColumnPatch(fields: MerchantProfileFields) {
  const logoUrl = fields.logoUrl.trim() || null;
  return {
    name: fields.shopName.trim(),
    shop_logo: logoUrl,
    // Keep avatar in sync so Explore / shop cards that still read avatar stay correct.
    avatar: logoUrl,
    shop_phone: fields.phone.trim() || null,
    shop_whatsapp: fields.whatsapp.trim() || null,
    shop_address: fields.address.trim() || null,
    shop_description: fields.description.trim() || null,
    shop_opening_hours: fields.openingHours.trim() || null,
  };
}

/** Also mirror into preferences for older clients / back-compat. */
export function merchantProfilePreferencesPatch(fields: MerchantProfileFields) {
  return {
    phone: fields.phone.trim() || null,
    whatsapp: fields.whatsapp.trim() || null,
    shopAddress: fields.address.trim() || null,
    shopDescription: fields.description.trim() || null,
    openingHours: fields.openingHours.trim() || null,
    shopLogo: fields.logoUrl.trim() || null,
    city: fields.city.trim() || null,
    district: fields.district.trim() || null,
  };
}
