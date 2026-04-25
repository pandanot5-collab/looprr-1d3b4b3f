
-- ============================================
-- PROFILES
-- ============================================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  avatar_url text,
  is_subscriber boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Profiles are viewable by everyone"
  on public.profiles for select using (true);

create policy "Users can insert their own profile"
  on public.profiles for insert with check (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update using (auth.uid() = id);

-- Username validation (length + basic banned words)
create or replace function public.validate_username()
returns trigger
language plpgsql
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

create trigger validate_username_trigger
  before insert or update on public.profiles
  for each row execute function public.validate_username();

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', 'user_' || substr(new.id::text, 1, 8)),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================
-- CATEGORIES (one per user, unique name)
-- ============================================
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade unique,
  name text not null,
  slug text not null unique,
  description text,
  created_at timestamptz not null default now()
);

create unique index categories_name_lower_idx on public.categories (lower(name));

alter table public.categories enable row level security;

create policy "Categories are viewable by everyone"
  on public.categories for select using (true);

create policy "Users can create one category"
  on public.categories for insert with check (auth.uid() = owner_id);

create policy "Owners can update their category"
  on public.categories for update using (auth.uid() = owner_id);

create policy "Owners can delete their category"
  on public.categories for delete using (auth.uid() = owner_id);

-- ============================================
-- VIDEOS
-- ============================================
create type public.video_platform as enum ('tiktok', 'youtube_shorts');

create table public.videos (
  id uuid primary key default gen_random_uuid(),
  posted_by uuid not null references public.profiles(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  url text not null,
  platform public.video_platform not null,
  external_id text,
  title text,
  thumbnail_url text,
  like_count integer not null default 0,
  dislike_count integer not null default 0,
  boost_count integer not null default 0,
  created_at timestamptz not null default now()
);

create index videos_category_idx on public.videos (category_id);
create index videos_feed_order_idx on public.videos (boost_count desc, created_at desc);

alter table public.videos enable row level security;

create policy "Videos are viewable by everyone"
  on public.videos for select using (true);

create policy "Users can post videos"
  on public.videos for insert with check (auth.uid() = posted_by);

create policy "Users can update own videos"
  on public.videos for update using (auth.uid() = posted_by);

create policy "Users can delete own videos"
  on public.videos for delete using (auth.uid() = posted_by);

-- ============================================
-- REACTIONS (like / dislike)
-- ============================================
create type public.reaction_type as enum ('like', 'dislike');

create table public.video_reactions (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references public.videos(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  reaction public.reaction_type not null,
  created_at timestamptz not null default now(),
  unique (video_id, user_id)
);

alter table public.video_reactions enable row level security;

create policy "Reactions are viewable by everyone"
  on public.video_reactions for select using (true);

create policy "Users can react"
  on public.video_reactions for insert with check (auth.uid() = user_id);

create policy "Users can update own reaction"
  on public.video_reactions for update using (auth.uid() = user_id);

create policy "Users can remove own reaction"
  on public.video_reactions for delete using (auth.uid() = user_id);

-- Counter triggers
create or replace function public.update_video_reaction_counts()
returns trigger
language plpgsql
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

create trigger video_reactions_count_trigger
  after insert or update or delete on public.video_reactions
  for each row execute function public.update_video_reaction_counts();

-- ============================================
-- BOOSTS (one per user per day per video)
-- ============================================
create table public.video_boosts (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references public.videos(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  boosted_on date not null default current_date,
  created_at timestamptz not null default now(),
  unique (user_id, boosted_on)
);

alter table public.video_boosts enable row level security;

create policy "Boosts are viewable by everyone"
  on public.video_boosts for select using (true);

create policy "Users can boost"
  on public.video_boosts for insert with check (auth.uid() = user_id);

create or replace function public.update_video_boost_count()
returns trigger
language plpgsql
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

create trigger video_boosts_count_trigger
  after insert or delete on public.video_boosts
  for each row execute function public.update_video_boost_count();
