import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST' && req.method !== 'GET') return jsonResponse(200, { error: 'Method not allowed' });

  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return jsonResponse(200, { error: 'Missing function env vars' });
    }

    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.replace('Bearer ', '').trim() : '';
    if (!token) return jsonResponse(200, { error: 'Missing bearer token' });

    const service = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: authData, error: authError } = await service.auth.getUser(token);
    if (authError || !authData?.user?.id) return jsonResponse(200, { error: 'Unauthorized user token' });

    const userId = authData.user.id;

    // Remove non-confirmed old records and keep a clean history.
    const { data: deletedRows, error: deleteError } = await service
      .from('merchant_subscription_payments')
      .delete()
      .eq('user_id', userId)
      .neq('status', 'confirmed')
      .select('id');

    if (deleteError) return jsonResponse(200, { error: deleteError.message });

    return jsonResponse(200, {
      deletedCount: deletedRows?.length || 0,
    });
  } catch (error) {
    console.error('merchant-subscription-cleanup error:', error);
    return jsonResponse(200, { error: (error as Error).message || 'Internal error' });
  }
});

