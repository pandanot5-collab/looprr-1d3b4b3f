-- Video reports table with reason
CREATE TABLE public.video_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  video_id UUID NOT NULL,
  user_id UUID NOT NULL,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (video_id, user_id)
);

ALTER TABLE public.video_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reports viewable by everyone (counts only)"
  ON public.video_reports FOR SELECT
  USING (true);

CREATE POLICY "Users can report"
  ON public.video_reports FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove own report"
  ON public.video_reports FOR DELETE
  USING (auth.uid() = user_id);

-- Add report_count and flagged columns on videos
ALTER TABLE public.videos
  ADD COLUMN IF NOT EXISTS report_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS flagged BOOLEAN NOT NULL DEFAULT false;

-- Function: required reports scales with likes.
-- Base 3, plus 1 extra per 10 likes (so a video with 50 likes needs 8, 100 needs 13).
CREATE OR REPLACE FUNCTION public.required_reports_for(_likes INT)
RETURNS INT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT GREATEST(3, 3 + (_likes / 10));
$$;

-- Trigger to keep report_count and flagged in sync
CREATE OR REPLACE FUNCTION public.update_video_report_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_likes INT;
  v_count INT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.videos
    SET report_count = report_count + 1
    WHERE id = NEW.video_id
    RETURNING like_count, report_count INTO v_likes, v_count;

    UPDATE public.videos
    SET flagged = (v_count >= public.required_reports_for(v_likes))
    WHERE id = NEW.video_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.videos
    SET report_count = GREATEST(0, report_count - 1)
    WHERE id = OLD.video_id
    RETURNING like_count, report_count INTO v_likes, v_count;

    UPDATE public.videos
    SET flagged = (v_count >= public.required_reports_for(v_likes))
    WHERE id = OLD.video_id;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_video_reports_count ON public.video_reports;
CREATE TRIGGER trg_video_reports_count
AFTER INSERT OR DELETE ON public.video_reports
FOR EACH ROW EXECUTE FUNCTION public.update_video_report_count();
