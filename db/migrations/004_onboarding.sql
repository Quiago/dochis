-- Alta, reclamo de perfil y revisión por embajadores.

-- Una solicitud guarda quién la pidió (teléfono o correo) y, en los reclamos, los datos propuestos:
-- el perfil no cambia hasta que un embajador la aprueba.
alter table verification_requests
  add column kind text not null default 'signup' check (kind in ('signup', 'claim', 'license')),
  add column identity text,
  add column payload jsonb not null default '{}',
  add column reviewed_at timestamptz,
  alter column reviewed_by type text;
create index on verification_requests (status, created_at);

-- Admins y embajadores entran con teléfono o correo (la tabla estaba vacía).
drop table admins;
create table admins (
  identity text primary key check (identity ~ '^\+[1-9][0-9]{6,14}$' or identity ~ '^[^@\s]+@[^@\s]+$'),
  role admin_role not null,
  scope text  -- especialidad para embajadores; null = todo
);

-- El correo también identifica al médico (login por correo).
create unique index doctors_email_key on doctors (lower(email)) where email is not null;
