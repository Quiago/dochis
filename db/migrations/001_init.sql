-- Esquema inicial del directorio. Ver CLAUDE.md > Modelo de datos.

create type regulator as enum ('DHA', 'DOH', 'MOHAP');
create type doctor_status as enum ('unclaimed', 'pending_verification', 'verified', 'stale', 'hidden');
create type challenge_status as enum ('pending', 'verified', 'expired');
create type bot_state as enum ('idle', 'awaiting_confirm_choice');
create type admin_role as enum ('admin', 'ambassador');
create type request_status as enum ('pending', 'approved', 'rejected');

create domain e164 as text check (value ~ '^\+[1-9][0-9]{6,14}$');

create table doctors (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  full_name text not null check (length(trim(full_name)) > 0),
  specialty text not null,
  clinic text not null,
  area text,
  emirate text not null,
  languages text[] not null default '{}',
  insurances text[] not null default '{}',
  regulator regulator,
  license_number text,
  phone_e164 e164 unique,            -- login; nunca público
  public_whatsapp e164,              -- solo con consentimiento explícito
  email text,
  status doctor_status not null default 'unclaimed',
  consent_at timestamptz,
  last_confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint whatsapp_needs_consent check (public_whatsapp is null or consent_at is not null)
);

create table confirmations (
  id bigint generated always as identity primary key,
  doctor_id uuid not null references doctors on delete cascade,
  confirmed_at timestamptz not null default now()
);
create index on confirmations (doctor_id, confirmed_at);

create table login_challenges (
  id uuid primary key default gen_random_uuid(),
  phone_e164 e164 not null,
  code_hash text not null,
  status challenge_status not null default 'pending',
  attempts int not null default 0,
  expires_at timestamptz not null default now() + interval '10 minutes',
  verified_at timestamptz,
  ip inet,
  created_at timestamptz not null default now()
);
create index on login_challenges (phone_e164, created_at);

create table bot_sessions (
  phone_e164 e164 primary key,
  state bot_state not null default 'idle',
  updated_at timestamptz not null default now()
);

create table reports (
  id bigint generated always as identity primary key,
  doctor_id uuid not null references doctors on delete cascade,
  reporter_fingerprint text not null,
  reason text not null,
  created_at timestamptz not null default now(),
  unique (doctor_id, reporter_fingerprint)
);

create table verification_requests (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null references doctors on delete cascade,
  license_number text not null,
  regulator regulator not null,
  status request_status not null default 'pending',
  reviewed_by e164,
  created_at timestamptz not null default now()
);

create table admins (
  phone_e164 e164 primary key,
  role admin_role not null,
  scope text
);

-- Roles de la app (a nivel de clúster; las contraseñas las fija scripts/migrate.ts desde las URLs).
do $$
begin
  if not exists (select from pg_roles where rolname = 'web_reader') then create role web_reader login; end if;
  if not exists (select from pg_roles where rolname = 'app_writer') then create role app_writer login; end if;
end $$;

-- Nadie crea objetos en el esquema salvo el dueño (el admin que migra).
revoke create on schema public from public;

-- app_writer: datos sí, esquema no (no es dueño de nada).
grant select, insert, update, delete on all tables in schema public to app_writer;
grant usage on all sequences in schema public to app_writer;
-- Tablas de futuras migraciones (creadas por el mismo admin) heredan estos permisos.
alter default privileges in schema public grant select, insert, update, delete on tables to app_writer;
alter default privileges in schema public grant usage on sequences to app_writer;

-- Única superficie pública. Corre con permisos del dueño (no security_invoker) a propósito:
-- expone solo columnas seguras. unclaimed: solo nombre, especialidad, clínica, zona y emirato.
create view public_doctors as
select
  id, slug, full_name, specialty, clinic, area, emirate,
  case when status = 'unclaimed' then '{}'::text[] else languages end as languages,
  case when status = 'unclaimed' then '{}'::text[] else insurances end as insurances,
  case when status = 'unclaimed' then null else regulator end as regulator,
  case when status = 'unclaimed' then null else public_whatsapp end as public_whatsapp,
  status::text as status,
  case when status = 'unclaimed' then null else last_confirmed_at end as last_confirmed_at
from doctors
where status in ('verified', 'stale', 'unclaimed');

create view public_confirmations as
select c.doctor_id, c.confirmed_at
from confirmations c
join doctors d on d.id = c.doctor_id
where d.status in ('verified', 'stale');

-- web_reader: solo las vistas, ninguna tabla.
grant select on public_doctors, public_confirmations to web_reader, app_writer;
