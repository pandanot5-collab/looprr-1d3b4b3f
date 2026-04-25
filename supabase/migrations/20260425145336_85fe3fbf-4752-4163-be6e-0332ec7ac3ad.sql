CREATE OR REPLACE FUNCTION public.required_reports_for(_likes INT)
RETURNS INT
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT GREATEST(3, 3 + (_likes / 10));
$$;
