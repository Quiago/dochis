-- La sesión se entrega una sola vez por challenge verificado.
alter table login_challenges add column consumed_at timestamptz;
create index on login_challenges (ip, created_at);
create index on login_challenges (created_at);
