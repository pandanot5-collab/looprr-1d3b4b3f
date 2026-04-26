-- Create app_role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

-- Create user_roles table (separate from profiles for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles (avoids recursive RLS)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- RLS: roles are publicly viewable (so we can show admin badges), only admins can manage
CREATE POLICY "Roles viewable by everyone"
ON public.user_roles FOR SELECT
USING (true);

CREATE POLICY "Admins can insert roles"
ON public.user_roles FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete roles"
ON public.user_roles FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Grant admin role to Panda
INSERT INTO public.user_roles (user_id, role)
VALUES ('465ac4ba-2532-4a53-b3fa-8e5de65a9938', 'admin');

-- Allow category owners (and admins) to delete videos in their category
CREATE POLICY "Category owners can delete videos"
ON public.videos FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.categories c
    WHERE c.id = videos.category_id AND c.owner_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin')
);