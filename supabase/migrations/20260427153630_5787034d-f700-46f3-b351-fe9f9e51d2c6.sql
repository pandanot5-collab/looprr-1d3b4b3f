-- Platform enum for creator badges
CREATE TYPE public.creator_platform AS ENUM ('youtube', 'tiktok');

CREATE TABLE public.creator_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  platform public.creator_platform NOT NULL,
  external_id text NOT NULL,           -- e.g. YouTube channel ID
  handle text,                          -- @handle or channel title
  subscriber_count integer NOT NULL DEFAULT 0,
  verified_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, platform)
);

ALTER TABLE public.creator_badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Creator badges viewable by everyone"
  ON public.creator_badges FOR SELECT
  USING (true);

CREATE POLICY "Users can insert their own badge"
  ON public.creator_badges FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own badge"
  ON public.creator_badges FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own badge"
  ON public.creator_badges FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can delete any badge"
  ON public.creator_badges FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_creator_badges_user ON public.creator_badges(user_id);