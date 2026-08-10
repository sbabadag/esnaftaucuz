import { readMerchantProfileFromUser, merchantProfileColumnPatch } from './merchant-profile.ts';

Deno.test('readMerchantProfileFromUser prefers DB columns over preferences', () => {
  const profile = readMerchantProfileFromUser({
    name: 'Manav Ali',
    avatar: 'https://old/avatar.png',
    shop_logo: 'https://cdn/logo.png',
    shop_phone: '05551112233',
    shop_whatsapp: '05551112233',
    shop_address: 'Cadde No:1',
    shop_description: 'Taze sebze',
    shop_opening_hours: '09-19',
    location: { city: 'Konya', district: 'Selçuklu' },
    preferences: {
      phone: '000',
      shopLogo: 'https://pref/logo.png',
      shopDescription: 'eski',
    },
  });

  if (profile.logoUrl !== 'https://cdn/logo.png') {
    throw new Error(`expected shop_logo, got ${profile.logoUrl}`);
  }
  if (profile.phone !== '05551112233') throw new Error('phone mismatch');
  if (profile.city !== 'Konya') throw new Error('city mismatch');
  if (profile.description !== 'Taze sebze') throw new Error('description mismatch');
});

Deno.test('merchantProfileColumnPatch writes logo to shop_logo and avatar', () => {
  const patch = merchantProfileColumnPatch({
    shopName: 'Test Dükkan',
    logoUrl: 'https://cdn/logo.png',
    phone: '0555',
    whatsapp: '',
    address: 'Adres',
    city: 'Konya',
    district: 'Meram',
    description: 'Açıklama',
    openingHours: '10-20',
  });

  if (patch.shop_logo !== 'https://cdn/logo.png') throw new Error('shop_logo missing');
  if (patch.avatar !== 'https://cdn/logo.png') throw new Error('avatar sync missing');
  if (patch.shop_phone !== '0555') throw new Error('shop_phone missing');
  if (patch.name !== 'Test Dükkan') throw new Error('name missing');
});
