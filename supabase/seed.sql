do $$
declare
  v_tournament_id uuid;
  v_round_id uuid;
  v_comp1_id uuid;
  v_comp2_id uuid;
  v_comp3_id uuid;
  v_comp4_id uuid;
begin
  insert into public.tournaments (name, slug, event_date, status)
  values ('Abierto de Primavera 3x3x3', 'abierto-primavera-3x3', current_date, 'active')
  on conflict (slug) do update set name = excluded.name
  returning id into v_tournament_id;

  select id into v_round_id
  from public.rounds
  where tournament_id = v_tournament_id
    and event_code = '333'
    and round_number = 1
  limit 1;

  if v_round_id is null then
    insert into public.rounds (
      tournament_id,
      event_code,
      event_name,
      round_number,
      name,
      status,
      sort_order
    )
    values (v_tournament_id, '333', '3x3x3 Cube', 1, 'Ronda 1', 'active', 1)
    returning id into v_round_id;
  end if;

  insert into public.competitors (tournament_id, bib_number, full_name, wca_id)
  values
    (v_tournament_id, 1, 'Mateo Herrera', '2022HERR01'),
    (v_tournament_id, 2, 'Valeria Mendoza', '2023MEND04'),
    (v_tournament_id, 3, 'Diego Rojas', null),
    (v_tournament_id, 4, 'Camila Navarro', '2024NAVA02')
  on conflict (tournament_id, bib_number) do nothing;

  select id into v_comp1_id
  from public.competitors
  where tournament_id = v_tournament_id and bib_number = 1;

  select id into v_comp2_id
  from public.competitors
  where tournament_id = v_tournament_id and bib_number = 2;

  select id into v_comp3_id
  from public.competitors
  where tournament_id = v_tournament_id and bib_number = 3;

  select id into v_comp4_id
  from public.competitors
  where tournament_id = v_tournament_id and bib_number = 4;

  insert into public.round_results (
    round_id,
    competitor_id,
    solves,
    best_cs,
    average_cs,
    completed_count
  )
  values
    (
      v_round_id,
      v_comp1_id,
      '[{"rawCs":984,"penalty":"NONE"},{"rawCs":1012,"penalty":"NONE"},{"rawCs":945,"penalty":"NONE"},{"rawCs":1103,"penalty":"NONE"},{"rawCs":1020,"penalty":"NONE"}]'::jsonb,
      945,
      1005,
      5
    ),
    (
      v_round_id,
      v_comp2_id,
      '[{"rawCs":1040,"penalty":"NONE"},{"rawCs":990,"penalty":"+2"},{"rawCs":null,"penalty":"DNF"},{"rawCs":1005,"penalty":"NONE"},{"rawCs":1030,"penalty":"NONE"}]'::jsonb,
      1005,
      1087,
      5
    ),
    (
      v_round_id,
      v_comp3_id,
      '[{"rawCs":1120,"penalty":"NONE"},{"rawCs":1085,"penalty":"NONE"},{"rawCs":1150,"penalty":"NONE"},{"rawCs":1095,"penalty":"NONE"},{"rawCs":null,"penalty":"NONE"}]'::jsonb,
      1085,
      null,
      4
    ),
    (
      v_round_id,
      v_comp4_id,
      '[{"rawCs":1210,"penalty":"NONE"},{"rawCs":1175,"penalty":"NONE"},{"rawCs":null,"penalty":"NONE"},{"rawCs":null,"penalty":"NONE"},{"rawCs":null,"penalty":"NONE"}]'::jsonb,
      1175,
      null,
      2
    )
  on conflict (round_id, competitor_id) do nothing;
end
$$;
