
-- Global per-tier color settings
CREATE TABLE public.tier_colors (
  tier public.subscription_tier PRIMARY KEY,
  color text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tier_colors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tier colors viewable by everyone"
ON public.tier_colors FOR SELECT
USING (true);

CREATE POLICY "Admins can insert tier colors"
ON public.tier_colors FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update tier colors"
ON public.tier_colors FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Seed sensible defaults (HSL strings, used in inline styles via hsl(...))
INSERT INTO public.tier_colors (tier, color) VALUES
  ('free',    '0 0% 50%'),
  ('starter', '200 90% 55%'),
  ('pro',     '280 90% 60%'),
  ('elite',   '45 100% 55%')
ON CONFLICT (tier) DO NOTHING;

-- Per-user override of their tier color
ALTER TABLE public.profiles
  ADD COLUMN tier_color_override text;
