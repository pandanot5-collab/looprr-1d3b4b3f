-- ========== 1) Lock down is_subscriber ==========
-- Drop the broad UPDATE policy and replace it with one that prevents
-- changing is_subscriber via direct table update.
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

CREATE POLICY "Users can update their own profile"
ON public.profiles
FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Trigger: prevent any non-service-role user from changing is_subscriber
CREATE OR REPLACE FUNCTION public.prevent_is_subscriber_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_subscriber IS DISTINCT FROM OLD.is_subscriber THEN
    -- Only allow when executed by service_role (server-side)
    IF current_setting('request.jwt.claims', true)::jsonb->>'role' <> 'service_role' THEN
      NEW.is_subscriber := OLD.is_subscriber;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_protect_subscriber ON public.profiles;
CREATE TRIGGER profiles_protect_subscriber
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_is_subscriber_change();

-- ========== 2) Follows ==========
CREATE TABLE public.follows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id uuid NOT NULL,
  following_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (follower_id, following_id),
  CHECK (follower_id <> following_id)
);

ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Follows are viewable by everyone"
ON public.follows FOR SELECT USING (true);

CREATE POLICY "Users can follow"
ON public.follows FOR INSERT
WITH CHECK (auth.uid() = follower_id);

CREATE POLICY "Users can unfollow"
ON public.follows FOR DELETE
USING (auth.uid() = follower_id);

CREATE INDEX idx_follows_follower ON public.follows(follower_id);
CREATE INDEX idx_follows_following ON public.follows(following_id);

-- ========== 3) Categories: locked + image_url ==========
ALTER TABLE public.categories
  ADD COLUMN locked boolean NOT NULL DEFAULT false,
  ADD COLUMN image_url text;

-- ========== 4) Category collaborators (allowlist when locked) ==========
CREATE TABLE public.category_collaborators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (category_id, user_id)
);

ALTER TABLE public.category_collaborators ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Collaborators are viewable by everyone"
ON public.category_collaborators FOR SELECT USING (true);

CREATE POLICY "Owners manage collaborators - insert"
ON public.category_collaborators FOR INSERT
WITH CHECK (
  EXISTS (SELECT 1 FROM public.categories c WHERE c.id = category_id AND c.owner_id = auth.uid())
);

CREATE POLICY "Owners manage collaborators - delete"
ON public.category_collaborators FOR DELETE
USING (
  EXISTS (SELECT 1 FROM public.categories c WHERE c.id = category_id AND c.owner_id = auth.uid())
);

-- ========== 5) Helper: can user post to category ==========
CREATE OR REPLACE FUNCTION public.can_post_to_category(_user_id uuid, _category_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.categories c
    WHERE c.id = _category_id
      AND (
        c.owner_id = _user_id
        OR c.locked = false
        OR EXISTS (
          SELECT 1 FROM public.category_collaborators cc
          WHERE cc.category_id = c.id AND cc.user_id = _user_id
        )
      )
  );
$$;

-- ========== 6) Update videos INSERT policy ==========
DROP POLICY IF EXISTS "Users can post videos" ON public.videos;

CREATE POLICY "Users can post videos"
ON public.videos FOR INSERT
WITH CHECK (
  auth.uid() = posted_by
  AND public.can_post_to_category(auth.uid(), category_id)
);

-- ========== 7) Storage bucket for category images ==========
INSERT INTO storage.buckets (id, name, public)
VALUES ('category-images', 'category-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Category images are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'category-images');

CREATE POLICY "Users can upload to their own folder in category-images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'category-images'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update their own category images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'category-images'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own category images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'category-images'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
