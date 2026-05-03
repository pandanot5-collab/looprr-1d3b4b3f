-- Heartbeats for active-user count
CREATE TABLE public.user_heartbeats (
  user_id uuid PRIMARY KEY,
  last_seen_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.user_heartbeats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own heartbeat" ON public.user_heartbeats
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own heartbeat" ON public.user_heartbeats
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own heartbeat" ON public.user_heartbeats
  FOR UPDATE USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.upsert_heartbeat()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;
  INSERT INTO public.user_heartbeats (user_id, last_seen_at)
  VALUES (auth.uid(), now())
  ON CONFLICT (user_id) DO UPDATE SET last_seen_at = now();
END; $$;

CREATE OR REPLACE FUNCTION public.get_active_user_count()
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COUNT(*)::int FROM public.user_heartbeats
  WHERE last_seen_at > now() - interval '5 hours';
$$;

-- Ad type enum
CREATE TYPE public.ad_type AS ENUM ('promoted_short', 'google');

CREATE TABLE public.ads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  posted_by uuid NOT NULL,
  ad_type public.ad_type NOT NULL DEFAULT 'promoted_short',
  url text,
  platform text,
  external_id text,
  title text,
  thumbnail_url text,
  google_slot text,
  target_impressions integer NOT NULL DEFAULT 1000,
  impressions_served integer NOT NULL DEFAULT 0,
  paid_amount_cents integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Active ads viewable by everyone" ON public.ads
  FOR SELECT USING (active = true OR auth.uid() = posted_by OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Users can create their own ads" ON public.ads
  FOR INSERT WITH CHECK (auth.uid() = posted_by);
CREATE POLICY "Owners can update their ads" ON public.ads
  FOR UPDATE USING (auth.uid() = posted_by OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Owners can delete their ads" ON public.ads
  FOR DELETE USING (auth.uid() = posted_by OR public.has_role(auth.uid(),'admin'));

CREATE TABLE public.ad_impressions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_id uuid NOT NULL REFERENCES public.ads(id) ON DELETE CASCADE,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ad_impressions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Impressions viewable by ad owner or admin" ON public.ad_impressions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.ads a WHERE a.id = ad_impressions.ad_id AND a.posted_by = auth.uid())
    OR public.has_role(auth.uid(),'admin')
  );

CREATE OR REPLACE FUNCTION public.record_ad_impression(_ad_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_target int;
  v_served int;
BEGIN
  INSERT INTO public.ad_impressions (ad_id, user_id) VALUES (_ad_id, auth.uid());
  UPDATE public.ads
    SET impressions_served = impressions_served + 1
    WHERE id = _ad_id
    RETURNING target_impressions, impressions_served INTO v_target, v_served;
  IF v_served >= v_target THEN
    UPDATE public.ads SET active = false WHERE id = _ad_id;
  END IF;
END; $$;

CREATE INDEX idx_ads_active ON public.ads(active) WHERE active = true;
CREATE INDEX idx_heartbeat_recent ON public.user_heartbeats(last_seen_at);