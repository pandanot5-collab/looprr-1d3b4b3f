-- Subscription tier enum
DO $$ BEGIN
  CREATE TYPE public.subscription_tier AS ENUM ('free', 'starter', 'pro', 'elite');
EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS subscription_tier public.subscription_tier NOT NULL DEFAULT 'free';

-- Backfill: existing subscribers map to 'pro'
UPDATE public.profiles SET subscription_tier = 'pro'
  WHERE is_subscriber = true AND subscription_tier = 'free';

-- Block client-side tier escalation (only service_role can change it)
CREATE OR REPLACE FUNCTION public.prevent_subscription_tier_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.subscription_tier IS DISTINCT FROM OLD.subscription_tier THEN
    IF current_setting('request.jwt.claims', true)::jsonb->>'role' <> 'service_role' THEN
      NEW.subscription_tier := OLD.subscription_tier;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_subscription_tier_change ON public.profiles;
CREATE TRIGGER prevent_subscription_tier_change
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_subscription_tier_change();

-- How many categories may a tier own? -1 = unlimited
CREATE OR REPLACE FUNCTION public.category_limit_for(_tier public.subscription_tier)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE _tier
    WHEN 'free'    THEN 1
    WHEN 'starter' THEN 3
    WHEN 'pro'     THEN 10
    WHEN 'elite'   THEN -1
  END;
$$;

-- Enforce category creation limit on insert
CREATE OR REPLACE FUNCTION public.enforce_category_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tier public.subscription_tier;
  v_limit integer;
  v_count integer;
BEGIN
  SELECT subscription_tier INTO v_tier FROM public.profiles WHERE id = NEW.owner_id;
  IF v_tier IS NULL THEN v_tier := 'free'; END IF;

  v_limit := public.category_limit_for(v_tier);
  IF v_limit = -1 THEN RETURN NEW; END IF;

  SELECT count(*) INTO v_count FROM public.categories WHERE owner_id = NEW.owner_id;
  IF v_count >= v_limit THEN
    RAISE EXCEPTION 'Category limit reached for your plan (% allowed). Upgrade to create more.', v_limit
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_category_limit ON public.categories;
CREATE TRIGGER enforce_category_limit
  BEFORE INSERT ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.enforce_category_limit();