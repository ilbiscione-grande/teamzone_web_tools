create table if not exists projects (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  data jsonb not null
);

create index if not exists projects_user_id_idx on projects(user_id);

alter table projects enable row level security;

drop policy if exists "Users can view their projects" on projects;
drop policy if exists "Users can insert their projects" on projects;
drop policy if exists "Users can update their projects" on projects;
drop policy if exists "Users can delete their projects" on projects;

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

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  plan text not null default 'FREE',
  stripe_customer_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table profiles enable row level security;

drop policy if exists "Users can view their profile" on profiles;

create policy "Users can view their profile"
on profiles
for select
using (auth.uid() = id);

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

create table if not exists public_boards (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  owner_email text not null,
  board_id text not null,
  board_name text not null,
  project_name text not null,
  title text not null,
  description text,
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
  tags text[] not null default '{}',
  status text not null default 'unverified',
  project_data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists public_projects_owner_project_idx
on public_projects(owner_id, project_id);

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
  user_email text,
  project_name text,
  board_name text,
  url text,
  user_agent text,
  body text not null
);

alter table bug_reports enable row level security;

drop policy if exists "Anyone can submit bug reports" on bug_reports;

create policy "Anyone can submit bug reports"
on bug_reports
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
