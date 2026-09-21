-- Verificación asistida: el número de licencia se publica (con consentimiento) para que cualquiera
-- pueda comprobarlo en el registro oficial. Los perfiles sin reclamar siguen sin mostrarlo.
create or replace view public_doctors as
select
  id, slug, full_name, specialty, clinic, area, emirate,
  case when status = 'unclaimed' then '{}'::text[] else languages end as languages,
  case when status = 'unclaimed' then '{}'::text[] else insurances end as insurances,
  case when status = 'unclaimed' then null else regulator end as regulator,
  case when status = 'unclaimed' then null else public_whatsapp end as public_whatsapp,
  status::text as status,
  case when status = 'unclaimed' then null else last_confirmed_at end as last_confirmed_at,
  case when status = 'unclaimed' then null else license_number end as license_number
from doctors
where status in ('verified', 'stale', 'unclaimed');
