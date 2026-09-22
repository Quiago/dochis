-- Foto o icono del médico: pequeña (≤200 KB, 256×256 hecha en el navegador), guardada en la base de datos.
alter table doctors
  add column photo bytea check (octet_length(photo) <= 200000),
  add column photo_type text check (photo_type in ('image/jpeg', 'image/webp')),
  add column photo_updated_at timestamptz;

create or replace view public_doctors as
select
  id, slug, full_name, specialty, clinic, area, emirate,
  case when status = 'unclaimed' then '{}'::text[] else languages end as languages,
  case when status = 'unclaimed' then '{}'::text[] else insurances end as insurances,
  case when status = 'unclaimed' then null else regulator end as regulator,
  case when status = 'unclaimed' then null else public_whatsapp end as public_whatsapp,
  status::text as status,
  case when status = 'unclaimed' then null else last_confirmed_at end as last_confirmed_at,
  case when status = 'unclaimed' then null else license_number end as license_number,
  case when status = 'unclaimed' then null else insurance_url end as insurance_url,
  case when status = 'unclaimed' or photo is null then null else extract(epoch from photo_updated_at)::bigint end as photo_version
from doctors
where status in ('verified', 'stale', 'unclaimed');

-- Solo las fotos de perfiles publicados y reclamados.
create view public_photos as
select slug, photo, photo_type from doctors where status in ('verified', 'stale') and photo is not null;
grant select on public_photos to web_reader, app_writer;
