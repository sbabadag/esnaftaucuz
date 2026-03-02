import { corsHeaders } from '../_shared/cors.ts';

Deno.serve((req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const url = new URL(req.url);
  const checkout = url.searchParams.get('checkout') || 'cancel';
  const paymentId = url.searchParams.get('paymentId') || '';
  const params = new URLSearchParams();
  params.set('checkout', checkout);
  if (paymentId) params.set('paymentId', paymentId);
  const deepLink = `com.esnaftaucuz.app://?${params.toString()}`;

  return new Response(null, {
    status: 302,
    headers: {
      ...corsHeaders,
      Location: deepLink,
      'Cache-Control': 'no-store',
    },
  });
});

