-- Add admin-controlled per-user color overrides for profile and videos
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS profile_color text,
  ADD COLUMN IF NOT EXISTS video_color text,
  ADD COLUMN IF NOT EXISTS subscription_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_paid_tier public.subscription_tier;

-- Backfill last_paid_tier for users who currently have a paid tier
UPDATE public.profiles
SET last_paid_tier = subscription_tier
WHERE subscription_tier <> 'free' AND last_paid_tier IS NULL;