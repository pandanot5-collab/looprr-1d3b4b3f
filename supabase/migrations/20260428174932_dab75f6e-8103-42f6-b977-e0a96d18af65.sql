-- ============ COMMENTS ============
CREATE TABLE public.video_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id uuid NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  body text NOT NULL CHECK (length(body) BETWEEN 1 AND 1000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_video_comments_video ON public.video_comments(video_id, created_at DESC);

ALTER TABLE public.video_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Comments viewable by everyone"
  ON public.video_comments FOR SELECT USING (true);

CREATE POLICY "Authed users can comment"
  ON public.video_comments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Author can delete own comment"
  ON public.video_comments FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Video owner / category owner / admin can delete comment"
  ON public.video_comments FOR DELETE
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.videos v
      WHERE v.id = video_comments.video_id
        AND (
          v.posted_by = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.categories c
            WHERE c.id = v.category_id AND c.owner_id = auth.uid()
          )
        )
    )
  );

-- ============ PROFILE EXTENSIONS ============
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS custom_gradient text,         -- e.g. "hsl(0 100% 50%), hsl(40 100% 60%)"
  ADD COLUMN IF NOT EXISTS custom_icon_url text,
  ADD COLUMN IF NOT EXISTS banned boolean NOT NULL DEFAULT false;

-- Admins can update any profile (for badges/ban)
CREATE POLICY "Admins can update any profile"
  ON public.profiles FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Case-sensitive unique on username (block new conflicts; existing keep)
-- Use a partial unique index that only enforces uniqueness on rows
-- inserted/updated AFTER existing duplicates remain.
-- Simpler: just add a normal UNIQUE — if there are no current duplicates this works.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'profiles_username_unique'
  ) THEN
    -- Only create if no duplicates exist; otherwise skip silently.
    IF NOT EXISTS (
      SELECT username FROM public.profiles GROUP BY username HAVING count(*) > 1
    ) THEN
      CREATE UNIQUE INDEX profiles_username_unique ON public.profiles(username);
    END IF;
  END IF;
END $$;

-- Trigger: prevent new signups/renames that collide case-sensitively
CREATE OR REPLACE FUNCTION public.enforce_unique_username()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.username <> OLD.username) THEN
    IF EXISTS (
      SELECT 1 FROM public.profiles
      WHERE username = NEW.username AND id <> NEW.id
    ) THEN
      RAISE EXCEPTION 'Username "%" is already taken', NEW.username
        USING ERRCODE = 'unique_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_unique_username ON public.profiles;
CREATE TRIGGER profiles_unique_username
  BEFORE INSERT OR UPDATE OF username ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.enforce_unique_username();

-- ============ VIDEOS HEALTH ============
ALTER TABLE public.videos
  ADD COLUMN IF NOT EXISTS last_checked_at timestamptz,
  ADD COLUMN IF NOT EXISTS dead boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_videos_dead ON public.videos(dead) WHERE dead = false;

-- Mark a video dead (any authenticated user can flag, server verifies separately;
-- this is called after a client-side embed fails to load).
CREATE OR REPLACE FUNCTION public.mark_video_dead(_video_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.videos SET dead = true, last_checked_at = now() WHERE id = _video_id;
$$;

-- Bump last_checked_at without changing dead state
CREATE OR REPLACE FUNCTION public.mark_video_alive(_video_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.videos SET last_checked_at = now() WHERE id = _video_id;
$$;

-- ============ ADMIN BAN ============
CREATE OR REPLACE FUNCTION public.admin_ban_user(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = 'insufficient_privilege';
  END IF;
  UPDATE public.profiles SET banned = true WHERE id = _user_id;
  DELETE FROM public.videos WHERE posted_by = _user_id;
  DELETE FROM public.video_comments WHERE user_id = _user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_unban_user(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = 'insufficient_privilege';
  END IF;
  UPDATE public.profiles SET banned = false WHERE id = _user_id;
END;
$$;

-- ============ STORAGE: user-icons bucket ============
INSERT INTO storage.buckets (id, name, public)
VALUES ('user-icons', 'user-icons', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "User icons publicly readable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'user-icons');

CREATE POLICY "Admins can upload user icons"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'user-icons' AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update user icons"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'user-icons' AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete user icons"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'user-icons' AND public.has_role(auth.uid(), 'admin'::app_role));
