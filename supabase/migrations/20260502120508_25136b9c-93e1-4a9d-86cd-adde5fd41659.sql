
-- 1) Add ownership/admin checks to mark_video_dead / mark_video_alive
CREATE OR REPLACE FUNCTION public.mark_video_dead(_video_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NOT (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (SELECT 1 FROM public.videos v WHERE v.id = _video_id AND v.posted_by = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.videos v
      JOIN public.categories c ON c.id = v.category_id
      WHERE v.id = _video_id AND c.owner_id = auth.uid()
    )
  ) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = 'insufficient_privilege';
  END IF;
  UPDATE public.videos SET dead = true, last_checked_at = now() WHERE id = _video_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_video_alive(_video_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NOT (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (SELECT 1 FROM public.videos v WHERE v.id = _video_id AND v.posted_by = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.videos v
      JOIN public.categories c ON c.id = v.category_id
      WHERE v.id = _video_id AND c.owner_id = auth.uid()
    )
  ) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = 'insufficient_privilege';
  END IF;
  UPDATE public.videos SET last_checked_at = now() WHERE id = _video_id;
END;
$$;

-- 2) Restrict user_roles SELECT so admin assignments aren't publicly enumerable
DROP POLICY IF EXISTS "Roles viewable by everyone" ON public.user_roles;

CREATE POLICY "Users can view own roles"
ON public.user_roles
FOR SELECT
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));
