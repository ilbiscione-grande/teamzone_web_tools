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

create table if not exists team_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member',
  created_at timestamptz not null default now(),
  unique(team_id, user_id)
);

create index if not exists team_members_user_id_idx on team_members(user_id);

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
);

create policy "Users can insert their teams"
on teams
for insert
with check (owner_id = auth.uid());

create policy "Users can update owned teams"
on teams
for update
using (owner_id = auth.uid());

create policy "Users can delete owned teams"
on teams
for delete
using (owner_id = auth.uid());

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
