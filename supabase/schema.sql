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
