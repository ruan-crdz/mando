-- WORLD_2026 - esquema base opcional no Supabase / PostgreSQL.
-- Revisar conflitos de nomes e permissões RLS no projeto existente.
create table if not exists public.mando_clubs (
 club_id text primary key, club_name text not null,
 country text, division text, season int, game_world text,
 roster_reference text, roster_2026_01_01_verified boolean,
 source_url text, player_count int
);
create table if not exists public.mando_players (
 player_id text primary key, world_id text not null,
 season int, club_id text references public.mando_clubs(club_id),
 club_name text, division text, full_name text, display_name text,
 name_is_full_legal_name_verified boolean, birth_date date,
 birth_date_source_url text, age_reported_in_source int,
 age_reference text, age_source_url text, nationality text, height_cm int, height_cm_mando_placeholder int, height_mando_is_synthetic boolean, shirt_number text,
 dominant_foot text, macro_position text, primary_position text,
 secondary_positions text, overall_mando int, potential_mando int,
 overall_is_synthetic boolean, market_value_external_eur bigint,
 market_value_external_source_url text, market_value_mando_eur bigint,
 market_value_mando_is_synthetic boolean, salary_public_eur_month bigint,
 salary_mando_eur_month bigint, salary_mando_is_synthetic boolean,
 contract_end_date date, contract_years_mando text,
 source_roster_url text, source_roster_type text, source_access_date date,
 roster_membership_at_2026_01_01_verified boolean,
 name_disambiguation_status text, data_quality text,
 mando_rating_method text, notes text
);
create table if not exists public.mando_player_attributes (
 player_id text primary key references public.mando_players(player_id),
 world_id text, source text, is_scouting_observed boolean,
 pace int, shooting int, passing int, dribbling int,
 defending int, physical int, mental int, goalkeeping int,
 technique int, strength int, stamina int, vision int, finishing int
);
-- RLS e políticas devem ser definidas de acordo com o backend existente.
