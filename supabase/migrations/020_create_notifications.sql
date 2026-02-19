-- Notifications table
-- Kullanıcı bildirimlerini saklayan tablo
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('price_drop', 'price_verified', 'nearby_cheap', 'contribution_verified', 'other')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  price_id UUID REFERENCES public.prices(id) ON DELETE CASCADE,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications(user_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_product_id ON public.notifications(product_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);

-- Row Level Security (RLS) Policies
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can read own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;

-- Users can read their own notifications
CREATE POLICY "Users can read own notifications" ON public.notifications
  FOR SELECT USING (auth.uid() = user_id);

-- Users can update their own notifications (mark as read)
CREATE POLICY "Users can update own notifications" ON public.notifications
  FOR UPDATE USING (auth.uid() = user_id);

-- Function to check for price drops and create notifications
CREATE OR REPLACE FUNCTION check_price_drop_and_notify()
RETURNS TRIGGER AS $$
DECLARE
  favorite_user RECORD;
  previous_min_price DECIMAL(10, 2);
  new_price DECIMAL(10, 2);
  product_name TEXT;
BEGIN
  -- Only process if this is a new price (INSERT) or price was updated
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.price != NEW.price) THEN
    new_price := NEW.price;
    
    -- Get product name
    SELECT name INTO product_name
    FROM public.products
    WHERE id = NEW.product_id;
    
    -- Find all users who favorited this product
    FOR favorite_user IN
      SELECT DISTINCT uf.user_id, u.preferences
      FROM public.user_favorites uf
      JOIN public.users u ON u.id = uf.user_id
      WHERE uf.product_id = NEW.product_id
        AND (u.preferences->>'notifications' IS NULL OR (u.preferences->>'notifications')::boolean = TRUE)
    LOOP
      -- Get the minimum price for this product before this new price
      SELECT COALESCE(MIN(price), 999999) INTO previous_min_price
      FROM public.prices
      WHERE product_id = NEW.product_id
        AND id != NEW.id
        AND is_active = TRUE
        AND created_at < NEW.created_at;
      
      -- If new price is lower than previous minimum, create notification
      IF new_price < previous_min_price THEN
        INSERT INTO public.notifications (
          user_id,
          type,
          title,
          message,
          product_id,
          price_id
        ) VALUES (
          favorite_user.user_id,
          'price_drop',
          'Fiyat Düştü! 🎉',
          product_name || ' ürününde yeni bir fiyat düşüşü var: ' || 
          new_price::TEXT || ' ₺ (Önceki en düşük: ' || previous_min_price::TEXT || ' ₺)',
          NEW.product_id,
          NEW.id
        );
      END IF;
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to check price drops when prices are inserted or updated
DROP TRIGGER IF EXISTS trigger_check_price_drop ON public.prices;
CREATE TRIGGER trigger_check_price_drop
  AFTER INSERT OR UPDATE OF price ON public.prices
  FOR EACH ROW
  WHEN (NEW.is_active = TRUE)
  EXECUTE FUNCTION check_price_drop_and_notify();

-- Grant permissions
GRANT SELECT, UPDATE ON public.notifications TO authenticated;

