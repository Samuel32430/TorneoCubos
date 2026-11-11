create table if not exists public.tournaments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  event_date date not null default current_date,
  status text not null default 'active' check (status in ('draft', 'active', 'finished')),
  created_at timestamptz not null default now()
);

create table if not exists public.rounds (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  event_code text not null default '333',
  event_name text not null default '3x3x3 Cube',
  round_number integer not null default 1,
  name text not null default 'Ronda 1',
  status text not null default 'active' check (status in ('upcoming', 'active', 'finished')),
  sort_order integer not null default 1,
  created_at timestamptz not null default now()
);

create table if not exists public.competitors (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  bib_number integer not null,
  full_name text not null,
  wca_id text,
  created_at timestamptz not null default now(),
  unique (tournament_id, bib_number)
);

create table if not exists public.round_results (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.rounds(id) on delete cascade,
  competitor_id uuid not null references public.competitors(id) on delete cascade,
  solves jsonb not null default '[{"rawCs":null,"penalty":"NONE"},{"rawCs":null,"penalty":"NONE"},{"rawCs":null,"penalty":"NONE"},{"rawCs":null,"penalty":"NONE"},{"rawCs":null,"penalty":"NONE"}]'::jsonb,
  best_cs integer,
  average_cs integer,
  completed_count integer not null default 0,
  updated_at timestamptz not null default now(),
  unique (round_id, competitor_id)
);

create index if not exists idx_rounds_tournament_id on public.rounds (tournament_id);
create index if not exists idx_competitors_tournament_id on public.competitors (tournament_id);
create index if not exists idx_round_results_round_id on public.round_results (round_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_updated_at on public.round_results;
create trigger set_updated_at
  before update on public.round_results
  for each row
  execute function public.set_updated_at();

alter table public.tournaments enable row level security;
alter table public.rounds enable row level security;
alter table public.competitors enable row level security;
alter table public.round_results enable row level security;

drop policy if exists "tournaments_select_public" on public.tournaments;
create policy "tournaments_select_public"
  on public.tournaments for select using (true);

drop policy if exists "tournaments_insert_authenticated" on public.tournaments;
create policy "tournaments_insert_authenticated"
  on public.tournaments for insert to authenticated with check (true);

drop policy if exists "tournaments_update_authenticated" on public.tournaments;
create policy "tournaments_update_authenticated"
  on public.tournaments for update to authenticated using (true) with check (true);

drop policy if exists "tournaments_delete_authenticated" on public.tournaments;
create policy "tournaments_delete_authenticated"
  on public.tournaments for delete to authenticated using (true);

drop policy if exists "rounds_select_public" on public.rounds;
create policy "rounds_select_public"
  on public.rounds for select using (true);

drop policy if exists "rounds_insert_authenticated" on public.rounds;
create policy "rounds_insert_authenticated"
  on public.rounds for insert to authenticated with check (true);

drop policy if exists "rounds_update_authenticated" on public.rounds;
create policy "rounds_update_authenticated"
  on public.rounds for update to authenticated using (true) with check (true);

drop policy if exists "rounds_delete_authenticated" on public.rounds;
create policy "rounds_delete_authenticated"
  on public.rounds for delete to authenticated using (true);

drop policy if exists "competitors_select_public" on public.competitors;
create policy "competitors_select_public"
  on public.competitors for select using (true);

drop policy if exists "competitors_insert_authenticated" on public.competitors;
create policy "competitors_insert_authenticated"
  on public.competitors for insert to authenticated with check (true);

drop policy if exists "competitors_update_authenticated" on public.competitors;
create policy "competitors_update_authenticated"
  on public.competitors for update to authenticated using (true) with check (true);

drop policy if exists "competitors_delete_authenticated" on public.competitors;
create policy "competitors_delete_authenticated"
  on public.competitors for delete to authenticated using (true);

drop policy if exists "round_results_select_public" on public.round_results;
create policy "round_results_select_public"
  on public.round_results for select using (true);

drop policy if exists "round_results_insert_authenticated" on public.round_results;
create policy "round_results_insert_authenticated"
  on public.round_results for insert to authenticated with check (true);

drop policy if exists "round_results_update_authenticated" on public.round_results;
create policy "round_results_update_authenticated"
  on public.round_results for update to authenticated using (true) with check (true);

drop policy if exists "round_results_delete_authenticated" on public.round_results;
create policy "round_results_delete_authenticated"
  on public.round_results for delete to authenticated using (true);

alter table public.rounds replica identity full;
alter table public.competitors replica identity full;
alter table public.round_results replica identity full;

do $$
declare
  tbl text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach tbl in array array['rounds', 'competitors', 'round_results']
    loop
      if not exists (
        select 1
        from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = tbl
      ) then
        execute format('alter publication supabase_realtime add table public.%I', tbl);
      end if;
    end loop;
  end if;
end
$$;
