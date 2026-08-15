-- 052_verify_price_rpc.sql
-- Fiyat doğrulama ("Onayla" butonu) RLS 044'te kırılmıştı: "Users can update own prices"
-- yalnızca fiyat sahibine UPDATE izni veriyor, doğrulama ise BAŞKA kullanıcıların
-- is_verified/verification_count alanlarını artırması. SECURITY DEFINER RPC ile çözülür —
-- istemci fiyat satırını doğrudan güncellemez, yalnızca bu fonksiyonu çağırır.

CREATE OR REPLACE FUNCTION public.verify_price(price_id uuid)
RETURNS SETOF public.prices
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE public.prices
     SET is_verified = true,
         verification_count = COALESCE(verification_count, 0) + 1
   WHERE id = price_id
   RETURNING verification_count INTO v_count;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Price not found' USING ERRCODE = 'P0002';
  END IF;

  RETURN QUERY
    SELECT p.*
      FROM public.prices p
     WHERE p.id = price_id;
END;
$$;

REVOKE ALL ON FUNCTION public.verify_price(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_price(uuid) TO authenticated;

COMMENT ON FUNCTION public.verify_price(uuid) IS
  'Fiyat doğrulama: authenticated kullanıcı is_verified/verification_count artırır (RLS 044 owner-only UPDATE bu işlemi engelliyordu).';
