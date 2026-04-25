CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
declare
  desired_username text;
  final_username text;
  attempt int := 0;
begin
  desired_username := coalesce(
    new.raw_user_meta_data->>'username',
    'user_' || substr(new.id::text, 1, 8)
  );
  final_username := desired_username;

  -- If the username is taken, append a short random suffix until unique
  while exists (select 1 from public.profiles where username = final_username) loop
    attempt := attempt + 1;
    final_username := desired_username || '_' || substr(md5(random()::text), 1, 4);
    if attempt > 10 then
      final_username := 'user_' || substr(new.id::text, 1, 8);
      exit;
    end if;
  end loop;

  insert into public.profiles (id, username, avatar_url)
  values (
    new.id,
    final_username,
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

-- Ensure trigger is attached to auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();