-- Seguros: la fuente fiable es la lista oficial de la clínica (aseguradora + plan + red). El médico la enlaza.
alter table doctors add column insurance_url text check (insurance_url ~ '^https://');
-- Correo de primera confirmación a los importados: una sola vez por médico.
alter table doctors add column invited_at timestamptz;

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
  case when status = 'unclaimed' then null else insurance_url end as insurance_url
from doctors
where status in ('verified', 'stale', 'unclaimed');
