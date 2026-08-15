-- 053_shop_reviews.sql
-- Dükkan değerlendirmeleri: kullanıcılar esnaf dükkanlarına 1-5 yıldız + yorum verir.
-- Amaç: gerçek kullanıcı puanlarıyla hem uygulama içi güven hem de web'de
-- LocalBusiness aggregateRating (Review rich snippet) şeması.

CREATE TABLE IF NOT EXISTS public.shop_reviews (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- Bir kullanıcı aynı dükkana yalnızca bir kez puan verebilir (upsert hedefi)
  UNIQUE (shop_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_shop_reviews_shop_id
  ON public.shop_reviews (shop_id, created_at DESC);

ALTER TABLE public.shop_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read shop reviews" ON public.shop_reviews;
CREATE POLICY "Anyone can read shop reviews"
  ON public.shop_reviews
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can manage own reviews" ON public.shop_reviews;
CREATE POLICY "Users can manage own reviews"
  ON public.shop_reviews
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid() AND shop_id <> auth.uid()); -- kendi dükkanına puan verilemez

GRANT SELECT ON public.shop_reviews TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shop_reviews TO authenticated;
