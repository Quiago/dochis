-- La licencia sigue siendo obligatoria al darse de alta (detecta duplicados y alimenta la revisión),
-- pero el profesional decide si se publica el número. El regulador se sigue viendo siempre.
alter table doctors add column show_license boolean not null default true;

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
  case when status = 'unclaimed' or photo is null then null else extract(epoch from photo_updated_at)::bigint end as photo_version
from doctors
where status in ('verified', 'stale', 'unclaimed');
