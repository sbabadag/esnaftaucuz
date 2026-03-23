import { createClient } from '@supabase/supabase-js';

type IdRow = { id: string };
type MerchantProductRow = { id: string; location_id: string | null };
type PriceRow = { id: string; location_id: string };

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const APPLY = process.argv.includes('--apply');
const TARGET_EMAILS = ['sbabadag@gmail.com', 'cesbabadag@gmail.com'];

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.');
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function uniqueIds(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.filter((v): v is string => Boolean(v))));
}

async function run(): Promise<void> {
  const { data: users, error: usersErr } = await admin
    .from('users')
    .select('id, email')
    .in('email', TARGET_EMAILS);

  if (usersErr) throw usersErr;

  const userIds = uniqueIds((users || []).map((u: any) => u.id));
  if (!userIds.length) {
    console.log('No users found for target emails. Nothing to do.');
    return;
  }

  const { data: priceRows, error: priceRowsErr } = await admin
    .from('prices')
    .select('id, location_id')
    .in('user_id', userIds);
  if (priceRowsErr) throw priceRowsErr;

  const { data: merchantRows, error: merchantRowsErr } = await admin
    .from('merchant_products')
    .select('id, location_id')
    .in('merchant_id', userIds);
  if (merchantRowsErr) throw merchantRowsErr;

  const merchantProductIds = uniqueIds(((merchantRows as MerchantProductRow[]) || []).map((m) => m.id));
  const priceIds = uniqueIds(((priceRows as PriceRow[]) || []).map((p) => p.id));
  const candidateLocationIds = uniqueIds([
    ...(((priceRows as PriceRow[]) || []).map((p) => p.location_id)),
    ...(((merchantRows as MerchantProductRow[]) || []).map((m) => m.location_id)),
  ]);

  const dryRunReport = {
    users: userIds.length,
    prices_by_users: priceIds.length,
    notifications_by_users: 0,
    merchant_products_by_users: merchantProductIds.length,
    merchant_product_verifications_by_users: 0,
    merchant_product_verifications_on_user_products: 0,
    user_favorites_by_users: 0,
    user_push_tokens_by_users: 0,
    merchant_subscription_payments_by_users: 0,
    candidate_locations_from_users_data: candidateLocationIds.length,
    deletable_locations_owned_only_by_user_data: 0,
  };

  const countByUserTable = async (table: string, column: string): Promise<number> => {
    const { count, error } = await admin
      .from(table)
      .select('id', { count: 'exact', head: true })
      .in(column, userIds);
    if (error) throw error;
    return count || 0;
  };

  dryRunReport.notifications_by_users = await countByUserTable('notifications', 'user_id');
  dryRunReport.user_favorites_by_users = await countByUserTable('user_favorites', 'user_id');
  dryRunReport.user_push_tokens_by_users = await countByUserTable('user_push_tokens', 'user_id');
  dryRunReport.merchant_subscription_payments_by_users = await countByUserTable('merchant_subscription_payments', 'user_id');
  dryRunReport.merchant_product_verifications_by_users = await countByUserTable('merchant_product_verifications', 'user_id');

  if (merchantProductIds.length) {
    const { count, error } = await admin
      .from('merchant_product_verifications')
      .select('id', { count: 'exact', head: true })
      .in('merchant_product_id', merchantProductIds);
    if (error) throw error;
    dryRunReport.merchant_product_verifications_on_user_products = count || 0;
  }

  const deletableLocationIds: string[] = [];
  for (const locationId of candidateLocationIds) {
    const [{ count: pricesRefCount, error: priceRefErr }, { count: merchantRefCount, error: merchantRefErr }] = await Promise.all([
      admin
        .from('prices')
        .select('id', { count: 'exact', head: true })
        .eq('location_id', locationId)
        .not('user_id', 'in', `(${userIds.join(',')})`),
      admin
        .from('merchant_products')
        .select('id', { count: 'exact', head: true })
        .eq('location_id', locationId)
        .not('merchant_id', 'in', `(${userIds.join(',')})`),
    ]);

    if (priceRefErr) throw priceRefErr;
    if (merchantRefErr) throw merchantRefErr;

    if ((pricesRefCount || 0) === 0 && (merchantRefCount || 0) === 0) {
      deletableLocationIds.push(locationId);
    }
  }

  dryRunReport.deletable_locations_owned_only_by_user_data = deletableLocationIds.length;

  console.log(JSON.stringify({ mode: APPLY ? 'apply' : 'dry-run', targetEmails: TARGET_EMAILS, userIds, dryRunReport }, null, 2));

  if (!APPLY) {
    console.log('\nDry run completed. Re-run with --apply to delete records.');
    return;
  }

  // 1) Verifications by these users
  await admin.from('merchant_product_verifications').delete().in('user_id', userIds);
  // 2) Verifications on these merchants' products (defensive; ON DELETE CASCADE should also handle)
  if (merchantProductIds.length) {
    await admin.from('merchant_product_verifications').delete().in('merchant_product_id', merchantProductIds);
  }
  // 3) Notifications created for these users
  await admin.from('notifications').delete().in('user_id', userIds);
  // 4) Favorites/push tokens/subscription payments for these users
  await admin.from('user_favorites').delete().in('user_id', userIds);
  await admin.from('user_push_tokens').delete().in('user_id', userIds);
  await admin.from('merchant_subscription_payments').delete().in('user_id', userIds);
  // 5) Prices entered by these users
  await admin.from('prices').delete().in('user_id', userIds);
  // 6) Merchant products entered by these users
  await admin.from('merchant_products').delete().in('merchant_id', userIds);
  // 7) Delete now-orphaned locations used only by these users' content
  if (deletableLocationIds.length) {
    await admin.from('locations').delete().in('id', deletableLocationIds);
  }

  const afterReport = {
    prices_by_users: await countByUserTable('prices', 'user_id'),
    merchant_products_by_users: await countByUserTable('merchant_products', 'merchant_id'),
    notifications_by_users: await countByUserTable('notifications', 'user_id'),
  };

  console.log(JSON.stringify({ status: 'done', afterReport }, null, 2));
}

run().catch((error) => {
  console.error('cleanup-user-mock-data failed:', error);
  process.exit(1);
});
