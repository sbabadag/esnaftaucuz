-- 054_campaigns.sql
-- Esnaf kampanyaları: esnaf dükkanına "haftasonu indirimi" gibi kampanyalar tanımlar.
-- Ana sayfada ve dükkan sayfasında görünür; SSG'de LocalBusiness makesOffer olarak işlenir.

CREATE TABLE IF NOT EXISTS public.campaigns (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  merchant_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_campaigns_active
  ON public.campaigns (is_active, ends_at);

ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read campaigns"
  ON public.campaigns
  FOR SELECT
  USING (true);

CREATE POLICY "Merchants manage own campaigns"
  ON public.campaigns
  FOR ALL
  USING (merchant_id = auth.uid())
  WITH CHECK (merchant_id = auth.uid());

GRANT SELECT ON public.campaigns TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaigns TO authenticated;
