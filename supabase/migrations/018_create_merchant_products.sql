-- Merchant Products table
-- Esnafların kendi ürünlerini sergilediği tablo
CREATE TABLE IF NOT EXISTS public.merchant_products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  merchant_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  price DECIMAL(10, 2) NOT NULL CHECK (price >= 0),
  unit TEXT NOT NULL CHECK (unit IN ('kg', 'adet', 'lt', 'paket')),
  images JSONB DEFAULT '[]'::jsonb, -- Array of image URLs
  location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL,
  coordinates POINT, -- Dükkan konumu
  verification_count INTEGER DEFAULT 0, -- Onaylanmış sayısı
  unverification_count INTEGER DEFAULT 0, -- Onaysız sayısı
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Bir esnaf aynı ürünü birden fazla kez ekleyemez
  UNIQUE(merchant_id, product_id)
);

-- Merchant Product Verifications table
-- Kullanıcıların esnaf ürünlerini onayladığı tablo
CREATE TABLE IF NOT EXISTS public.merchant_product_verifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  merchant_product_id UUID NOT NULL REFERENCES public.merchant_products(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  is_verified BOOLEAN DEFAULT TRUE, -- TRUE = onaylandı, FALSE = onaysız
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Bir kullanıcı aynı ürünü sadece bir kez onaylayabilir/onaysız yapabilir
  UNIQUE(merchant_product_id, user_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_merchant_products_merchant_id ON public.merchant_products(merchant_id);
CREATE INDEX IF NOT EXISTS idx_merchant_products_product_id ON public.merchant_products(product_id);
CREATE INDEX IF NOT EXISTS idx_merchant_products_location_id ON public.merchant_products(location_id);
CREATE INDEX IF NOT EXISTS idx_merchant_products_coordinates ON public.merchant_products USING GIST(coordinates);
CREATE INDEX IF NOT EXISTS idx_merchant_products_is_active ON public.merchant_products(is_active, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_merchant_product_verifications_merchant_product_id ON public.merchant_product_verifications(merchant_product_id);
CREATE INDEX IF NOT EXISTS idx_merchant_product_verifications_user_id ON public.merchant_product_verifications(user_id);

-- Function to update verification counts
CREATE OR REPLACE FUNCTION update_merchant_product_verification_counts()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Yeni onay eklendiğinde
    IF NEW.is_verified THEN
      UPDATE public.merchant_products
      SET verification_count = verification_count + 1,
          updated_at = NOW()
      WHERE id = NEW.merchant_product_id;
    ELSE
      UPDATE public.merchant_products
      SET unverification_count = unverification_count + 1,
          updated_at = NOW()
      WHERE id = NEW.merchant_product_id;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    -- Onay silindiğinde
    IF OLD.is_verified THEN
      UPDATE public.merchant_products
      SET verification_count = GREATEST(verification_count - 1, 0),
          updated_at = NOW()
      WHERE id = OLD.merchant_product_id;
    ELSE
      UPDATE public.merchant_products
      SET unverification_count = GREATEST(unverification_count - 1, 0),
          updated_at = NOW()
      WHERE id = OLD.merchant_product_id;
    END IF;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Onay durumu değiştiğinde
    IF OLD.is_verified != NEW.is_verified THEN
      IF NEW.is_verified THEN
        -- Onaysız'dan onaylı'ya geçti
        UPDATE public.merchant_products
        SET verification_count = verification_count + 1,
            unverification_count = GREATEST(unverification_count - 1, 0),
            updated_at = NOW()
        WHERE id = NEW.merchant_product_id;
      ELSE
        -- Onaylı'dan onaysız'a geçti
        UPDATE public.merchant_products
        SET verification_count = GREATEST(verification_count - 1, 0),
            unverification_count = unverification_count + 1,
            updated_at = NOW()
        WHERE id = NEW.merchant_product_id;
      END IF;
    END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update verification counts
CREATE TRIGGER trigger_update_merchant_product_verification_counts
  AFTER INSERT OR UPDATE OR DELETE ON public.merchant_product_verifications
  FOR EACH ROW
  EXECUTE FUNCTION update_merchant_product_verification_counts();

-- RLS Policies for merchant_products
ALTER TABLE public.merchant_products ENABLE ROW LEVEL SECURITY;

-- Esnaflar kendi ürünlerini görebilir ve ekleyebilir
CREATE POLICY "Merchants can view own products"
  ON public.merchant_products
  FOR SELECT
  USING (
    merchant_id = auth.uid() OR
    is_active = TRUE -- Herkes aktif ürünleri görebilir
  );

CREATE POLICY "Merchants can insert own products"
  ON public.merchant_products
  FOR INSERT
  WITH CHECK (
    merchant_id = auth.uid() AND
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_merchant = TRUE)
  );

CREATE POLICY "Merchants can update own products"
  ON public.merchant_products
  FOR UPDATE
  USING (merchant_id = auth.uid())
  WITH CHECK (merchant_id = auth.uid());

CREATE POLICY "Merchants can delete own products"
  ON public.merchant_products
  FOR DELETE
  USING (merchant_id = auth.uid());

-- RLS Policies for merchant_product_verifications
ALTER TABLE public.merchant_product_verifications ENABLE ROW LEVEL SECURITY;

-- Herkes onayları görebilir
CREATE POLICY "Anyone can view verifications"
  ON public.merchant_product_verifications
  FOR SELECT
  USING (TRUE);

-- Kullanıcılar kendi onaylarını ekleyebilir/güncelleyebilir
CREATE POLICY "Users can manage own verifications"
  ON public.merchant_product_verifications
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.merchant_products TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.merchant_product_verifications TO authenticated;

