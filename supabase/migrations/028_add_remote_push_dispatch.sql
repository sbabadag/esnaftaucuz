-- Remote push notifications (iOS + Android) via FCM.
-- This migration:
-- 1) stores device push tokens per user
-- 2) calls an Edge Function when a new notification row is inserted

CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE TABLE IF NOT EXISTS public.user_push_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_push_tokens_user_id ON public.user_push_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_user_push_tokens_active ON public.user_push_tokens(user_id, is_active);

CREATE OR REPLACE FUNCTION public.update_user_push_tokens_updated_at_fn()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

ALTER TABLE public.user_push_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own push tokens" ON public.user_push_tokens;
DROP POLICY IF EXISTS "Users can create own push tokens" ON public.user_push_tokens;
DROP POLICY IF EXISTS "Users can update own push tokens" ON public.user_push_tokens;
DROP POLICY IF EXISTS "Users can delete own push tokens" ON public.user_push_tokens;

CREATE POLICY "Users can read own push tokens" ON public.user_push_tokens
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own push tokens" ON public.user_push_tokens
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own push tokens" ON public.user_push_tokens
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own push tokens" ON public.user_push_tokens
  FOR DELETE USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_user_push_tokens_updated_at ON public.user_push_tokens;
CREATE TRIGGER update_user_push_tokens_updated_at
  BEFORE UPDATE ON public.user_push_tokens
  FOR EACH ROW
  EXECUTE FUNCTION public.update_user_push_tokens_updated_at_fn();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_push_tokens TO authenticated;

CREATE OR REPLACE FUNCTION public.dispatch_remote_push_for_notification()
RETURNS TRIGGER AS $$
BEGIN
  -- Only dispatch for relevant notification types.
  IF NEW.type IN ('price_drop', 'price_verified', 'nearby_cheap', 'contribution_verified', 'other') THEN
    -- Calls edge function endpoint; function reads notification row and sends FCM push.
    PERFORM net.http_post(
      url := 'https://xmskjcdwmwlcmjexnnxw.supabase.co/functions/v1/dispatch-notification-push',
      headers := jsonb_build_object(
        'Content-Type', 'application/json'
      ),
      body := jsonb_build_object(
        'notification_id', NEW.id,
        'user_id', NEW.user_id,
        'type', NEW.type
      )
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_dispatch_remote_push_notification ON public.notifications;
CREATE TRIGGER trigger_dispatch_remote_push_notification
  AFTER INSERT ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.dispatch_remote_push_for_notification();
