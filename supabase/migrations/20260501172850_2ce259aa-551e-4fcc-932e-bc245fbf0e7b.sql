-- 1. Lock down creator_badges: only service role (edge function) may write
DROP POLICY IF EXISTS "Users can insert their own badge" ON public.creator_badges;
DROP POLICY IF EXISTS "Users can update their own badge" ON public.creator_badges;
-- Keep: SELECT public, user DELETE own, admin DELETE any

-- 2. Restrict video_reports SELECT to author + admins
DROP POLICY IF EXISTS "Reports viewable by everyone (counts only)" ON public.video_reports;

CREATE POLICY "Reporters and admins can view reports"
ON public.video_reports
FOR SELECT
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));
