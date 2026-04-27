-- Add view_count to videos
ALTER TABLE public.videos
ADD COLUMN IF NOT EXISTS view_count integer NOT NULL DEFAULT 0;

-- Atomic view increment callable by anyone (including anonymous)
CREATE OR REPLACE FUNCTION public.increment_video_view(_video_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.videos SET view_count = view_count + 1 WHERE id = _video_id;
$$;

GRANT EXECUTE ON FUNCTION public.increment_video_view(uuid) TO anon, authenticated;