
create or replace function public.validate_username()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  banned text[] := array['admin', 'root', 'fuck', 'shit', 'nigger', 'faggot', 'retard', 'bitch', 'cunt', 'nazi'];
  bad text;
begin
  if length(new.username) < 3 or length(new.username) > 20 then
    raise exception 'Username must be 3-20 characters';
  end if;
  if new.username !~ '^[a-zA-Z0-9_]+$' then
    raise exception 'Username can only contain letters, numbers, and underscores';
  end if;
  foreach bad in array banned loop
    if lower(new.username) like '%' || bad || '%' then
      raise exception 'Username contains disallowed words';
    end if;
  end loop;
  return new;
end;
$$;

create or replace function public.update_video_reaction_counts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.reaction = 'like' then
      update public.videos set like_count = like_count + 1 where id = new.video_id;
    else
      update public.videos set dislike_count = dislike_count + 1 where id = new.video_id;
    end if;
  elsif tg_op = 'DELETE' then
    if old.reaction = 'like' then
      update public.videos set like_count = greatest(0, like_count - 1) where id = old.video_id;
    else
      update public.videos set dislike_count = greatest(0, dislike_count - 1) where id = old.video_id;
    end if;
  elsif tg_op = 'UPDATE' and old.reaction <> new.reaction then
    if new.reaction = 'like' then
      update public.videos set like_count = like_count + 1, dislike_count = greatest(0, dislike_count - 1) where id = new.video_id;
    else
      update public.videos set dislike_count = dislike_count + 1, like_count = greatest(0, like_count - 1) where id = new.video_id;
    end if;
  end if;
  return null;
end;
$$;

create or replace function public.update_video_boost_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.videos set boost_count = boost_count + 1 where id = new.video_id;
  elsif tg_op = 'DELETE' then
    update public.videos set boost_count = greatest(0, boost_count - 1) where id = old.video_id;
  end if;
  return null;
end;
$$;
