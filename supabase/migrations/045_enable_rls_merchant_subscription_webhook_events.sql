-- Lock down webhook event log: public schema but service_role only.
-- Clients (anon/authenticated) must not read or write webhook payloads.

ALTER TABLE public.merchant_subscription_webhook_events ENABLE ROW LEVEL SECURITY;

-- No policies for anon/authenticated → denied by default when RLS is on.
-- service_role bypasses RLS in Supabase; keep explicit grants for clarity.
REVOKE ALL ON TABLE public.merchant_subscription_webhook_events FROM PUBLIC;
REVOKE ALL ON TABLE public.merchant_subscription_webhook_events FROM anon;
REVOKE ALL ON TABLE public.merchant_subscription_webhook_events FROM authenticated;

GRANT SELECT, INSERT ON TABLE public.merchant_subscription_webhook_events TO service_role;
