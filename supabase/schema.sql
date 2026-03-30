create table if not exists projects (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  data jsonb not null
);

create table if not exists project_boards (
  id text primary key,
  project_id text not null references projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  board_name text not null,
  order_index integer not null default 0,
  updated_at timestamptz not null default now(),
  board_data jsonb not null
);

create index if not exists projects_user_id_idx on projects(user_id);
create index if not exists project_boards_project_id_idx on project_boards(project_id);
create index if not exists project_boards_user_id_idx on project_boards(user_id);

alter table projects enable row level security;
alter table project_boards enable row level security;

drop policy if exists "Users can view their projects" on projects;
drop policy if exists "Users can insert their projects" on projects;
drop policy if exists "Users can update their projects" on projects;
drop policy if exists "Users can delete their projects" on projects;
drop policy if exists "Users can view their project boards" on project_boards;
drop policy if exists "Users can insert their project boards" on project_boards;
drop policy if exists "Users can update their project boards" on project_boards;
drop policy if exists "Users can delete their project boards" on project_boards;

create policy "Users can view their projects"
on projects
for select
using (auth.uid() = user_id);

create policy "Users can insert their projects"
on projects
for insert
with check (auth.uid() = user_id);

create policy "Users can update their projects"
on projects
for update
using (auth.uid() = user_id);

create policy "Users can delete their projects"
on projects
for delete
using (auth.uid() = user_id);

create policy "Users can view their project boards"
on project_boards
for select
using (auth.uid() = user_id);

create policy "Users can insert their project boards"
on project_boards
for insert
with check (auth.uid() = user_id);

create policy "Users can update their project boards"
on project_boards
for update
using (auth.uid() = user_id);

create policy "Users can delete their project boards"
on project_boards
for delete
using (auth.uid() = user_id);

insert into project_boards (id, project_id, user_id, board_name, order_index, updated_at, board_data)
select
  coalesce((board_item ->> 'id'), gen_random_uuid()::text) as id,
  p.id as project_id,
  p.user_id,
  coalesce(board_item ->> 'name', 'Board') as board_name,
  board_item_index as order_index,
  p.updated_at as updated_at,
  board_item as board_data
from projects p
cross join lateral jsonb_array_elements(coalesce(p.data -> 'boards', '[]'::jsonb)) with ordinality as b(board_item, board_item_index)
on conflict (id) do update set
  board_name = excluded.board_name,
  order_index = excluded.order_index,
  updated_at = excluded.updated_at,
  board_data = excluded.board_data;

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  plan text not null default 'FREE',
  stripe_customer_id text,
  beta_user boolean not null default false,
  is_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table profiles add column if not exists beta_user boolean not null default false;
alter table profiles add column if not exists is_admin boolean not null default false;

alter table profiles enable row level security;

drop policy if exists "Users can view their profile" on profiles;

create policy "Users can view their profile"
on profiles
for select
using (auth.uid() = id);

create table if not exists user_sessions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  session_key text not null,
  updated_at timestamptz not null default now()
);

alter table user_sessions enable row level security;

drop policy if exists "Users can view their session" on user_sessions;
drop policy if exists "Users can upsert their session" on user_sessions;

create policy "Users can view their session"
on user_sessions
for select
using (auth.uid() = user_id);

create policy "Users can upsert their session"
on user_sessions
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.profiles (id, plan)
  values (new.id, 'FREE')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

insert into public.profiles (id, plan)
select id, 'FREE' from auth.users
on conflict (id) do nothing;

create table if not exists squad_presets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  squad_data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists squad_presets_user_id_idx on squad_presets(user_id);

alter table squad_presets enable row level security;

drop policy if exists "Users can view their squad presets" on squad_presets;
drop policy if exists "Users can insert their squad presets" on squad_presets;
drop policy if exists "Users can update their squad presets" on squad_presets;
drop policy if exists "Users can delete their squad presets" on squad_presets;

create policy "Users can view their squad presets"
on squad_presets
for select
using (auth.uid() = user_id);

create policy "Users can insert their squad presets"
on squad_presets
for insert
with check (auth.uid() = user_id);

create policy "Users can update their squad presets"
on squad_presets
for update
using (auth.uid() = user_id);

create policy "Users can delete their squad presets"
on squad_presets
for delete
using (auth.uid() = user_id);

create table if not exists project_share_links (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id text not null,
  project_name text not null,
  project_data jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists project_share_links_user_id_idx on project_share_links(user_id);
create index if not exists project_share_links_token_idx on project_share_links(token);

alter table project_share_links enable row level security;

drop policy if exists "Public can view project share links" on project_share_links;
drop policy if exists "Users can view own project share links" on project_share_links;
drop policy if exists "Users can insert project share links" on project_share_links;
drop policy if exists "Users can delete project share links" on project_share_links;

create policy "Users can view own project share links"
on project_share_links
for select
using (auth.uid() = user_id);

create policy "Users can insert project share links"
on project_share_links
for insert
with check (auth.uid() = user_id);

create policy "Users can delete project share links"
on project_share_links
for delete
using (auth.uid() = user_id);

create or replace function public.get_project_share_link(p_token text)
returns table (
  id uuid,
  token text,
  project_id text,
  project_name text,
  project_data jsonb,
  created_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    l.id,
    l.token,
    l.project_id,
    l.project_name,
    l.project_data,
    l.created_at
  from public.project_share_links l
  where l.token = p_token
  limit 1;
$$;

revoke all on function public.get_project_share_link(text) from public;
grant execute on function public.get_project_share_link(text) to anon, authenticated;

create table if not exists public_boards (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  owner_email text not null,
  board_id text not null,
  board_name text not null,
  project_name text not null,
  title text not null,
  description text,
  category text not null default '',
  tags text[] not null default '{}',
  formation text,
  thumbnail text,
  status text not null default 'unverified',
  board_data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public_boards
add column if not exists thumbnail text;

alter table public_boards
add column if not exists category text not null default '';

create unique index if not exists public_boards_owner_board_idx
on public_boards(owner_id, board_id);

create index if not exists public_boards_status_idx on public_boards(status);

alter table public_boards enable row level security;

drop policy if exists "Public boards are viewable" on public_boards;
drop policy if exists "Users can publish boards" on public_boards;
drop policy if exists "Users can update their public boards" on public_boards;
drop policy if exists "Users can delete their public boards" on public_boards;

create policy "Public boards are viewable"
on public_boards
for select
using (
  status in ('verified','reviewed') or auth.uid() = owner_id
);

create policy "Users can publish boards"
on public_boards
for insert
with check (auth.uid() = owner_id);

create policy "Users can update their public boards"
on public_boards
for update
using (auth.uid() = owner_id);

create policy "Users can delete their public boards"
on public_boards
for delete
using (auth.uid() = owner_id);

create table if not exists public_board_reports (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public_boards(id) on delete cascade,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reporter_email text not null,
  reason text not null,
  created_at timestamptz not null default now()
);

alter table public_board_reports enable row level security;

drop policy if exists "Users can report public boards" on public_board_reports;

create policy "Users can report public boards"
on public_board_reports
for insert
with check (auth.uid() = reporter_id);

create table if not exists public_projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  owner_email text not null,
  project_id text not null,
  project_name text not null,
  title text not null,
  description text,
  category text not null default '',
  tags text[] not null default '{}',
  status text not null default 'unverified',
  project_data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists public_projects_owner_project_idx
on public_projects(owner_id, project_id);

alter table public_projects
add column if not exists category text not null default '';

create index if not exists public_projects_status_idx on public_projects(status);

alter table public_projects enable row level security;

drop policy if exists "Public projects are viewable" on public_projects;
drop policy if exists "Users can publish projects" on public_projects;
drop policy if exists "Users can update their public projects" on public_projects;
drop policy if exists "Users can delete their public projects" on public_projects;

create policy "Public projects are viewable"
on public_projects
for select
using (
  status in ('verified','reviewed') or auth.uid() = owner_id
);

create policy "Users can publish projects"
on public_projects
for insert
with check (auth.uid() = owner_id);

create policy "Users can update their public projects"
on public_projects
for update
using (auth.uid() = owner_id);

create policy "Users can delete their public projects"
on public_projects
for delete
using (auth.uid() = owner_id);

create table if not exists public_project_reports (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public_projects(id) on delete cascade,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reporter_email text not null,
  reason text not null,
  created_at timestamptz not null default now()
);

alter table public_project_reports enable row level security;

drop policy if exists "Users can report public projects" on public_project_reports;

create policy "Users can report public projects"
on public_project_reports
for insert
with check (auth.uid() = reporter_id);

create table if not exists bug_reports (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  context text not null,
  plan text not null,
  report_type text not null default 'bug',
  user_email text,
  project_name text,
  board_name text,
  url text,
  user_agent text,
  body text not null
);

alter table bug_reports add column if not exists report_type text not null default 'bug';

alter table bug_reports enable row level security;

drop policy if exists "Anyone can submit bug reports" on bug_reports;

create policy "Anyone can submit bug reports"
on bug_reports
for insert
with check (true);

create table if not exists app_analytics_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid not null references auth.users(id) on delete cascade,
  user_email text,
  session_key text,
  event_type text not null,
  tool text,
  duration_ms integer,
  path text,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists app_analytics_events_user_id_idx
  on app_analytics_events(user_id);
create index if not exists app_analytics_events_event_type_idx
  on app_analytics_events(event_type);
create index if not exists app_analytics_events_created_at_idx
  on app_analytics_events(created_at desc);

alter table app_analytics_events enable row level security;

drop policy if exists "Users can insert own analytics events" on app_analytics_events;
drop policy if exists "Admins can view analytics events" on app_analytics_events;

create policy "Users can insert own analytics events"
on app_analytics_events
for insert
with check (auth.uid() = user_id);

create policy "Admins can view analytics events"
on app_analytics_events
for select
using (
  exists (
    select 1
    from profiles
    where profiles.id = auth.uid()
      and profiles.is_admin = true
  )
);

drop policy if exists "Admins can view bug reports" on bug_reports;

create policy "Admins can view bug reports"
on bug_reports
for select
using (
  exists (
    select 1
    from profiles
    where profiles.id = auth.uid()
      and profiles.is_admin = true
  )
);

create table if not exists contact_messages (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  plan text not null,
  user_email text,
  subject text,
  message text not null,
  url text,
  user_agent text
);

alter table contact_messages enable row level security;

drop policy if exists "Anyone can submit contact messages" on contact_messages;

create policy "Anyone can submit contact messages"
on contact_messages
for insert
with check (true);

create table if not exists board_shares (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  owner_email text not null,
  recipient_email text not null,
  board_id text not null,
  board_name text not null,
  project_name text not null,
  permission text not null default 'comment',
  board_data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists board_shares_owner_id_idx on board_shares(owner_id);
create index if not exists board_shares_recipient_email_idx on board_shares(recipient_email);
create index if not exists board_shares_board_id_idx on board_shares(board_id);

alter table board_shares enable row level security;

drop policy if exists "Owners can manage their board shares" on board_shares;
drop policy if exists "Recipients can view their board shares" on board_shares;

create policy "Owners can manage their board shares"
on board_shares
for all
using (auth.uid() = owner_id)
with check (auth.uid() = owner_id);

create policy "Recipients can view their board shares"
on board_shares
for select
using ((auth.jwt() ->> 'email') = recipient_email);

create table if not exists board_comments (
  id uuid primary key default gen_random_uuid(),
  share_id uuid not null references board_shares(id) on delete cascade,
  board_id text not null,
  frame_id text,
  object_id text,
  author_id uuid not null references auth.users(id) on delete cascade,
  author_email text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists board_comments_share_id_idx on board_comments(share_id);
create index if not exists board_comments_board_id_idx on board_comments(board_id);

alter table board_comments enable row level security;

drop policy if exists "Users can view comments for shared boards" on board_comments;
drop policy if exists "Users can add comments for shared boards" on board_comments;
drop policy if exists "Authors can delete their comments" on board_comments;

create policy "Users can view comments for shared boards"
on board_comments
for select
using (
  exists (
    select 1
    from board_shares s
    where s.id = board_comments.share_id
      and (
        s.owner_id = auth.uid()
        or (auth.jwt() ->> 'email') = s.recipient_email
      )
  )
);

create policy "Users can add comments for shared boards"
on board_comments
for insert
with check (
  exists (
    select 1
    from board_shares s
    where s.id = board_comments.share_id
      and (
        s.owner_id = auth.uid()
        or (
          (auth.jwt() ->> 'email') = s.recipient_email
          and s.permission = 'comment'
        )
      )
  )
  and auth.uid() = author_id
);

create policy "Authors can delete their comments"
on board_comments
for delete
using (auth.uid() = author_id);

-- Club + Team foundation (phase 1, backwards-compatible with current team model)
create table if not exists clubs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique,
  logo_url text,
  kit_shirt text not null default '#e4573f',
  kit_shirt_secondary text not null default '#f3f3f3',
  kit_shorts text not null default '#f3f3f3',
  kit_socks text not null default '#f3f3f3',
  kit_vest text,
  kit_jersey_type text not null default 'solid',
  created_by_user_id uuid references auth.users(id) on delete set null,
  primary_admin_user_id uuid references auth.users(id) on delete set null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists clubs_primary_admin_idx on clubs(primary_admin_user_id);
create index if not exists clubs_created_by_idx on clubs(created_by_user_id);

create table if not exists club_members (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  club_role text not null default 'member',
  is_club_admin boolean not null default false,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(club_id, user_id)
);

create index if not exists club_members_user_idx on club_members(user_id);
create index if not exists club_members_club_idx on club_members(club_id);
create index if not exists club_members_admin_idx on club_members(club_id, is_club_admin);

create or replace function public.is_club_member(target_club_id uuid, target_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.club_members cm
    where cm.club_id = target_club_id
      and cm.user_id = target_user_id
  );
$$;

create or replace function public.is_club_admin(target_club_id uuid, target_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.club_members cm
    where cm.club_id = target_club_id
      and cm.user_id = target_user_id
      and cm.is_club_admin = true
  );
$$;

create or replace function public.is_team_member(target_team_id uuid, target_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.team_members tm
    where tm.team_id = target_team_id
      and tm.user_id = target_user_id
  );
$$;

create or replace function public.is_team_admin_member(target_team_id uuid, target_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.team_members tm
    where tm.team_id = target_team_id
      and tm.user_id = target_user_id
      and tm.is_team_admin = true
  );
$$;

alter table clubs enable row level security;
alter table club_members enable row level security;

drop policy if exists "Users can view their clubs" on clubs;
drop policy if exists "Users can insert their clubs" on clubs;
drop policy if exists "Club admins can update clubs" on clubs;
drop policy if exists "Club admins can delete clubs" on clubs;

create policy "Users can view their clubs"
on clubs
for select
using (
  public.is_club_member(clubs.id, auth.uid())
  or primary_admin_user_id = auth.uid()
  or created_by_user_id = auth.uid()
);

create policy "Users can insert their clubs"
on clubs
for insert
with check (
  created_by_user_id = auth.uid()
  or primary_admin_user_id = auth.uid()
);

create policy "Club admins can update clubs"
on clubs
for update
using (
  primary_admin_user_id = auth.uid()
  or public.is_club_admin(clubs.id, auth.uid())
);

create policy "Club admins can delete clubs"
on clubs
for delete
using (
  primary_admin_user_id = auth.uid()
  or public.is_club_admin(clubs.id, auth.uid())
);

drop policy if exists "Users can view club memberships" on club_members;
drop policy if exists "Club admins can insert club memberships" on club_members;
drop policy if exists "Club admins can update club memberships" on club_members;
drop policy if exists "Club admins can delete club memberships" on club_members;

create policy "Users can view club memberships"
on club_members
for select
using (
  user_id = auth.uid()
  or public.is_club_admin(club_members.club_id, auth.uid())
  or exists (
    select 1
    from clubs c
    where c.id = club_members.club_id
      and c.primary_admin_user_id = auth.uid()
  )
);

create policy "Club admins can insert club memberships"
on club_members
for insert
with check (
  public.is_club_admin(club_members.club_id, auth.uid())
  or exists (
    select 1
    from clubs c
    where c.id = club_members.club_id
      and c.primary_admin_user_id = auth.uid()
  )
);

create policy "Club admins can update club memberships"
on club_members
for update
using (
  public.is_club_admin(club_members.club_id, auth.uid())
  or exists (
    select 1
    from clubs c
    where c.id = club_members.club_id
      and c.primary_admin_user_id = auth.uid()
  )
);

create policy "Club admins can delete club memberships"
on club_members
for delete
using (
  public.is_club_admin(club_members.club_id, auth.uid())
  or exists (
    select 1
    from clubs c
    where c.id = club_members.club_id
      and c.primary_admin_user_id = auth.uid()
  )
);

-- Team + Squad model (one squad per team, with loaned players support)
create table if not exists teams (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  club_logo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists teams_owner_id_idx on teams(owner_id);

alter table teams add column if not exists club_id uuid references clubs(id) on delete set null;
alter table teams add column if not exists slug text;
alter table teams add column if not exists team_type text not null default 'other';
alter table teams add column if not exists age_group text;
alter table teams add column if not exists season_label text;
alter table teams add column if not exists status text not null default 'active';
alter table teams add column if not exists kit_shirt text not null default '#e4573f';
alter table teams add column if not exists kit_shirt_secondary text not null default '#f3f3f3';
alter table teams add column if not exists kit_shorts text not null default '#f3f3f3';
alter table teams add column if not exists kit_socks text not null default '#f3f3f3';
alter table teams add column if not exists kit_vest text;
alter table teams add column if not exists kit_jersey_type text not null default 'solid';
alter table teams alter column kit_shirt drop not null;
alter table teams alter column kit_shirt_secondary drop not null;
alter table teams alter column kit_shorts drop not null;
alter table teams alter column kit_socks drop not null;
alter table teams alter column kit_jersey_type drop not null;
alter table teams alter column kit_shirt drop default;
alter table teams alter column kit_shirt_secondary drop default;
alter table teams alter column kit_shorts drop default;
alter table teams alter column kit_socks drop default;
alter table teams alter column kit_jersey_type drop default;

create index if not exists teams_club_id_idx on teams(club_id);
create index if not exists teams_club_status_idx on teams(club_id, status);

create table if not exists team_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member',
  created_at timestamptz not null default now(),
  unique(team_id, user_id)
);

create index if not exists team_members_user_id_idx on team_members(user_id);

alter table team_members alter column user_id drop not null;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'club_members'
      and column_name = 'membership_role'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'club_members'
      and column_name = 'club_role'
  ) then
    alter table public.club_members rename column membership_role to club_role;
  end if;
end $$;

alter table team_members add column if not exists club_member_id uuid references club_members(id) on delete set null;
alter table team_members add column if not exists display_name text;
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'team_members'
      and column_name = 'member_role'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'team_members'
      and column_name = 'team_role'
  ) then
    alter table public.team_members rename column member_role to team_role;
  end if;
end $$;

alter table team_members add column if not exists team_role text not null default 'other';
alter table team_members add column if not exists team_position text;
alter table team_members add column if not exists is_team_admin boolean not null default false;
alter table team_members add column if not exists is_guest boolean not null default false;
alter table team_members add column if not exists is_active boolean not null default true;
alter table team_members add column if not exists shirt_number integer;
alter table team_members add column if not exists photo_url text;
alter table team_members add column if not exists email text;
alter table team_members add column if not exists phone text;
alter table team_members add column if not exists sort_order integer not null default 0;
alter table team_members add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table team_members add column if not exists updated_at timestamptz not null default now();

create index if not exists team_members_team_idx on team_members(team_id);
create index if not exists team_members_team_role_idx on team_members(team_id, team_role);
create index if not exists team_members_team_admin_idx on team_members(team_id, is_team_admin);
create index if not exists team_members_club_member_idx on team_members(club_member_id);
create index if not exists team_members_team_position_idx on team_members(team_id, team_position);

create table if not exists board_team_selections (
  id uuid primary key default gen_random_uuid(),
  board_id text not null references project_boards(id) on delete cascade,
  side text not null check (side in ('home', 'away')),
  team_id uuid not null references teams(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(board_id, side)
);

create index if not exists board_team_selections_board_idx on board_team_selections(board_id);
create index if not exists board_team_selections_team_idx on board_team_selections(team_id);

create table if not exists board_player_overrides (
  id uuid primary key default gen_random_uuid(),
  board_id text not null references project_boards(id) on delete cascade,
  team_member_id uuid not null references team_members(id) on delete cascade,
  override_number integer,
  override_position text,
  display_name_override text,
  is_hidden boolean not null default false,
  is_guest boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(board_id, team_member_id)
);

create index if not exists board_player_overrides_board_idx on board_player_overrides(board_id);
create index if not exists board_player_overrides_team_member_idx on board_player_overrides(team_member_id);

alter table board_team_selections enable row level security;
alter table board_player_overrides enable row level security;

drop policy if exists "Users can view their board team selections" on board_team_selections;
drop policy if exists "Users can insert their board team selections" on board_team_selections;
drop policy if exists "Users can update their board team selections" on board_team_selections;
drop policy if exists "Users can delete their board team selections" on board_team_selections;

create policy "Users can view their board team selections"
on board_team_selections
for select
using (
  exists (
    select 1
    from project_boards pb
    where pb.id = board_team_selections.board_id
      and pb.user_id = auth.uid()
  )
);

create policy "Users can insert their board team selections"
on board_team_selections
for insert
with check (
  exists (
    select 1
    from project_boards pb
    where pb.id = board_team_selections.board_id
      and pb.user_id = auth.uid()
  )
);

create policy "Users can update their board team selections"
on board_team_selections
for update
using (
  exists (
    select 1
    from project_boards pb
    where pb.id = board_team_selections.board_id
      and pb.user_id = auth.uid()
  )
);

create policy "Users can delete their board team selections"
on board_team_selections
for delete
using (
  exists (
    select 1
    from project_boards pb
    where pb.id = board_team_selections.board_id
      and pb.user_id = auth.uid()
  )
);

drop policy if exists "Users can view their board player overrides" on board_player_overrides;
drop policy if exists "Users can insert their board player overrides" on board_player_overrides;
drop policy if exists "Users can update their board player overrides" on board_player_overrides;
drop policy if exists "Users can delete their board player overrides" on board_player_overrides;

create policy "Users can view their board player overrides"
on board_player_overrides
for select
using (
  exists (
    select 1
    from project_boards pb
    where pb.id = board_player_overrides.board_id
      and pb.user_id = auth.uid()
  )
);

create policy "Users can insert their board player overrides"
on board_player_overrides
for insert
with check (
  exists (
    select 1
    from project_boards pb
    where pb.id = board_player_overrides.board_id
      and pb.user_id = auth.uid()
  )
);

create policy "Users can update their board player overrides"
on board_player_overrides
for update
using (
  exists (
    select 1
    from project_boards pb
    where pb.id = board_player_overrides.board_id
      and pb.user_id = auth.uid()
  )
);

create policy "Users can delete their board player overrides"
on board_player_overrides
for delete
using (
  exists (
    select 1
    from project_boards pb
    where pb.id = board_player_overrides.board_id
      and pb.user_id = auth.uid()
  )
);

create table if not exists team_squads (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null unique references teams(id) on delete cascade,
  name text not null,
  kit_data jsonb not null,
  captain_player_id uuid,
  substitute_player_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists team_players (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  name text not null,
  position_label text not null default 'POS',
  is_active boolean not null default true,
  number integer,
  vest_color text,
  photo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table team_players
add column if not exists is_active boolean not null default true;

create index if not exists team_players_team_id_idx on team_players(team_id);

create table if not exists team_squad_players (
  id uuid primary key default gen_random_uuid(),
  squad_id uuid not null references team_squads(id) on delete cascade,
  player_id uuid not null references team_players(id) on delete cascade,
  order_index integer not null default 0,
  is_captain boolean not null default false,
  is_substitute boolean not null default false,
  source_team_id uuid references teams(id) on delete set null,
  source_player_id uuid references team_players(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(squad_id, player_id)
);

create index if not exists team_squad_players_squad_id_idx
on team_squad_players(squad_id);

create index if not exists team_squad_players_source_team_id_idx
on team_squad_players(source_team_id);

alter table teams enable row level security;
alter table team_members enable row level security;
alter table team_squads enable row level security;
alter table team_players enable row level security;
alter table team_squad_players enable row level security;

drop policy if exists "Users can view their teams" on teams;
drop policy if exists "Users can insert their teams" on teams;
drop policy if exists "Users can update owned teams" on teams;
drop policy if exists "Users can delete owned teams" on teams;

create policy "Users can view their teams"
on teams
for select
using (
  owner_id = auth.uid()
  or public.is_team_member(teams.id, auth.uid())
  or public.is_club_member(teams.club_id, auth.uid())
);

create policy "Users can insert their teams"
on teams
for insert
with check (
  owner_id = auth.uid()
  or public.is_club_admin(teams.club_id, auth.uid())
);

create policy "Users can update owned teams"
on teams
for update
using (
  owner_id = auth.uid()
  or public.is_team_admin_member(teams.id, auth.uid())
  or public.is_club_admin(teams.club_id, auth.uid())
);

create policy "Users can delete owned teams"
on teams
for delete
using (
  owner_id = auth.uid()
  or public.is_club_admin(teams.club_id, auth.uid())
);

drop policy if exists "Users can view team memberships" on team_members;
drop policy if exists "Owners can insert team memberships" on team_members;
drop policy if exists "Owners can update team memberships" on team_members;
drop policy if exists "Owners can delete team memberships" on team_members;

create policy "Users can view team memberships"
on team_members
for select
using (
  user_id = auth.uid()
  or exists (
    select 1
    from teams t
    where t.id = team_members.team_id
      and t.owner_id = auth.uid()
  )
  or public.is_team_member(team_members.team_id, auth.uid())
  or exists (
    select 1
    from teams t
    where t.id = team_members.team_id
      and public.is_club_member(t.club_id, auth.uid())
  )
);

create policy "Owners can insert team memberships"
on team_members
for insert
with check (
  exists (
    select 1
    from teams t
    where t.id = team_members.team_id
      and t.owner_id = auth.uid()
  )
  or public.is_team_admin_member(team_members.team_id, auth.uid())
  or exists (
    select 1
    from teams t
    where t.id = team_members.team_id
      and public.is_club_admin(t.club_id, auth.uid())
  )
);

create policy "Owners can update team memberships"
on team_members
for update
using (
  exists (
    select 1
    from teams t
    where t.id = team_members.team_id
      and t.owner_id = auth.uid()
  )
  or public.is_team_admin_member(team_members.team_id, auth.uid())
  or exists (
    select 1
    from teams t
    where t.id = team_members.team_id
      and public.is_club_admin(t.club_id, auth.uid())
  )
);

create policy "Owners can delete team memberships"
on team_members
for delete
using (
  exists (
    select 1
    from teams t
    where t.id = team_members.team_id
      and t.owner_id = auth.uid()
  )
  or public.is_team_admin_member(team_members.team_id, auth.uid())
  or exists (
    select 1
    from teams t
    where t.id = team_members.team_id
      and public.is_club_admin(t.club_id, auth.uid())
  )
);

drop policy if exists "Users can view team squads" on team_squads;
drop policy if exists "Users can insert team squads" on team_squads;
drop policy if exists "Users can update team squads" on team_squads;
drop policy if exists "Users can delete team squads" on team_squads;

create policy "Users can view team squads"
on team_squads
for select
using (
  exists (
    select 1
    from teams t
    where t.id = team_squads.team_id
      and (
        t.owner_id = auth.uid()
        or exists (
          select 1
          from team_members tm
          where tm.team_id = t.id
            and tm.user_id = auth.uid()
        )
      )
  )
);

create policy "Users can insert team squads"
on team_squads
for insert
with check (
  exists (
    select 1
    from teams t
    where t.id = team_squads.team_id
      and (
        t.owner_id = auth.uid()
        or exists (
          select 1
          from team_members tm
          where tm.team_id = t.id
            and tm.user_id = auth.uid()
        )
      )
  )
);

create policy "Users can update team squads"
on team_squads
for update
using (
  exists (
    select 1
    from teams t
    where t.id = team_squads.team_id
      and (
        t.owner_id = auth.uid()
        or exists (
          select 1
          from team_members tm
          where tm.team_id = t.id
            and tm.user_id = auth.uid()
        )
      )
  )
);

create policy "Users can delete team squads"
on team_squads
for delete
using (
  exists (
    select 1
    from teams t
    where t.id = team_squads.team_id
      and (
        t.owner_id = auth.uid()
        or exists (
          select 1
          from team_members tm
          where tm.team_id = t.id
            and tm.user_id = auth.uid()
        )
      )
  )
);

drop policy if exists "Users can view team players" on team_players;
drop policy if exists "Users can insert team players" on team_players;
drop policy if exists "Users can update team players" on team_players;
drop policy if exists "Users can delete team players" on team_players;

create policy "Users can view team players"
on team_players
for select
using (
  exists (
    select 1
    from teams t
    where t.id = team_players.team_id
      and (
        t.owner_id = auth.uid()
        or exists (
          select 1
          from team_members tm
          where tm.team_id = t.id
            and tm.user_id = auth.uid()
        )
      )
  )
);

create policy "Users can insert team players"
on team_players
for insert
with check (
  exists (
    select 1
    from teams t
    where t.id = team_players.team_id
      and (
        t.owner_id = auth.uid()
        or exists (
          select 1
          from team_members tm
          where tm.team_id = t.id
            and tm.user_id = auth.uid()
        )
      )
  )
);

create policy "Users can update team players"
on team_players
for update
using (
  exists (
    select 1
    from teams t
    where t.id = team_players.team_id
      and (
        t.owner_id = auth.uid()
        or exists (
          select 1
          from team_members tm
          where tm.team_id = t.id
            and tm.user_id = auth.uid()
        )
      )
  )
);

create policy "Users can delete team players"
on team_players
for delete
using (
  exists (
    select 1
    from teams t
    where t.id = team_players.team_id
      and (
        t.owner_id = auth.uid()
        or exists (
          select 1
          from team_members tm
          where tm.team_id = t.id
            and tm.user_id = auth.uid()
        )
      )
  )
);

drop policy if exists "Users can view team squad players" on team_squad_players;
drop policy if exists "Users can insert team squad players" on team_squad_players;
drop policy if exists "Users can update team squad players" on team_squad_players;
drop policy if exists "Users can delete team squad players" on team_squad_players;

create policy "Users can view team squad players"
on team_squad_players
for select
using (
  exists (
    select 1
    from team_squads ts
    join teams t on t.id = ts.team_id
    where ts.id = team_squad_players.squad_id
      and (
        t.owner_id = auth.uid()
        or exists (
          select 1
          from team_members tm
          where tm.team_id = t.id
            and tm.user_id = auth.uid()
        )
      )
  )
);

create policy "Users can insert team squad players"
on team_squad_players
for insert
with check (
  exists (
    select 1
    from team_squads ts
    join teams t on t.id = ts.team_id
    where ts.id = team_squad_players.squad_id
      and (
        t.owner_id = auth.uid()
        or exists (
          select 1
          from team_members tm
          where tm.team_id = t.id
            and tm.user_id = auth.uid()
        )
      )
  )
);

create policy "Users can update team squad players"
on team_squad_players
for update
using (
  exists (
    select 1
    from team_squads ts
    join teams t on t.id = ts.team_id
    where ts.id = team_squad_players.squad_id
      and (
        t.owner_id = auth.uid()
        or exists (
          select 1
          from team_members tm
          where tm.team_id = t.id
            and tm.user_id = auth.uid()
        )
      )
  )
);

create policy "Users can delete team squad players"
on team_squad_players
for delete
using (
  exists (
    select 1
    from team_squads ts
    join teams t on t.id = ts.team_id
    where ts.id = team_squad_players.squad_id
      and (
        t.owner_id = auth.uid()
        or exists (
          select 1
          from team_members tm
          where tm.team_id = t.id
            and tm.user_id = auth.uid()
        )
      )
  )
);

-- Phase 1 backfill for club + membership model
--
-- This section is intentionally non-destructive. It creates a default club
-- for existing team owners, connects legacy teams to that club, creates club
-- memberships, and backfills richer team membership records from the current
-- team/player structure.

insert into clubs (
  name,
  slug,
  created_by_user_id,
  primary_admin_user_id,
  status
)
select
  coalesce(nullif(trim(t.name), ''), 'Club') || ' Club' as name,
  lower(
    regexp_replace(
      coalesce(nullif(trim(t.name), ''), 'club') || '-' || left(t.owner_id::text, 8),
      '[^a-z0-9]+',
      '-',
      'g'
    )
  ) as slug,
  t.owner_id,
  t.owner_id,
  'active'
from (
  select distinct owner_id, min(name) as name
  from teams
  where owner_id is not null
  group by owner_id
) t
where not exists (
  select 1
  from clubs c
  where c.created_by_user_id = t.owner_id
);

update teams
set
  club_id = c.id,
  updated_at = now()
from clubs c
where teams.club_id is null
  and c.created_by_user_id = teams.owner_id;

insert into club_members (
  club_id,
  user_id,
  club_role,
  is_club_admin,
  status
)
select
  c.id,
  c.primary_admin_user_id,
  'staff',
  true,
  'active'
from clubs c
where c.primary_admin_user_id is not null
  and not exists (
    select 1
    from club_members cm
    where cm.club_id = c.id
      and cm.user_id = c.primary_admin_user_id
  );

insert into team_members (
  team_id,
  user_id,
  role,
  display_name,
  team_role,
  team_position,
  is_team_admin,
  is_guest,
  is_active,
  sort_order,
  updated_at
)
select
  t.id as team_id,
  t.owner_id as user_id,
  'owner' as role,
  null as display_name,
  'leader' as team_role,
  'head_coach' as team_position,
  true as is_team_admin,
  false as is_guest,
  true as is_active,
  -1000 as sort_order,
  now() as updated_at
from teams t
where t.owner_id is not null
  and not exists (
    select 1
    from team_members tm
    where tm.team_id = t.id
      and tm.user_id = t.owner_id
  );

update team_members tm
set
  club_member_id = cm.id,
  updated_at = now()
from teams t
join club_members cm
  on cm.club_id = t.club_id
where tm.team_id = t.id
  and tm.user_id is not null
  and cm.user_id = tm.user_id
  and tm.club_member_id is null;

insert into team_members (
  team_id,
  user_id,
  role,
  display_name,
  team_role,
  team_position,
  is_team_admin,
  is_guest,
  is_active,
  shirt_number,
  photo_url,
  sort_order,
  metadata,
  updated_at
)
select
  tp.team_id,
  null as user_id,
  'member' as role,
  tp.name as display_name,
  'player' as team_role,
  tp.position_label as team_position,
  false as is_team_admin,
  false as is_guest,
  coalesce(tp.is_active, true) as is_active,
  tp.number as shirt_number,
  tp.photo_url,
  coalesce(tsp.order_index, 0) as sort_order,
  jsonb_build_object(
    'legacy_team_player_id', tp.id,
    'legacy_vest_color', tp.vest_color
  ) as metadata,
  now() as updated_at
from team_players tp
left join team_squads ts
  on ts.team_id = tp.team_id
left join team_squad_players tsp
  on tsp.squad_id = ts.id
 and tsp.player_id = tp.id
where not exists (
  select 1
  from team_members tm
  where tm.team_id = tp.team_id
    and tm.user_id is null
    and tm.display_name = tp.name
    and coalesce(tm.shirt_number, -1) = coalesce(tp.number, -1)
    and tm.team_role = 'player'
);
