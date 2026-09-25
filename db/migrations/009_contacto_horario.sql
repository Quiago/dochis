-- Contacto y horario, todo opcional. El correo de entrar (doctors.email) nunca se publica:
-- public_email es un campo aparte que el profesional escribe a propósito.
alter table doctors
  add column public_email text,
  add column links text[] not null default '{}',
  add column hours_weekday_open time,
  add column hours_weekday_close time,
  add column hours_weekend_open time,
  add column hours_weekend_close time;

create or replace view public_doctors as
select
  id, slug, full_name, specialty, clinic, area, emirate,
  case when status = 'unclaimed' then '{}'::text[] else languages end as languages,
  case when status = 'unclaimed' then '{}'::text[] else insurances end as insurances,
  case when status = 'unclaimed' then null else regulator end as regulator,
  case when status = 'unclaimed' then null else public_whatsapp end as public_whatsapp,
  status::text as status,
  case when status = 'unclaimed' then null else last_confirmed_at end as last_confirmed_at,
  case when status = 'unclaimed' or not show_license then null else license_number end as license_number,
  case when status = 'unclaimed' then null else insurance_url end as insurance_url,
  case when status = 'unclaimed' or photo is null then null else extract(epoch from photo_updated_at)::bigint end as photo_version,
  case when status = 'unclaimed' then null else public_email end as public_email,
  case when status = 'unclaimed' then '{}'::text[] else links end as links,
  case when status = 'unclaimed' then null else to_char(hours_weekday_open, 'HH24:MI') end as hours_weekday_open,
  case when status = 'unclaimed' then null else to_char(hours_weekday_close, 'HH24:MI') end as hours_weekday_close,
  case when status = 'unclaimed' then null else to_char(hours_weekend_open, 'HH24:MI') end as hours_weekend_open,
  case when status = 'unclaimed' then null else to_char(hours_weekend_close, 'HH24:MI') end as hours_weekend_close
from doctors
where status in ('verified', 'stale', 'unclaimed');
