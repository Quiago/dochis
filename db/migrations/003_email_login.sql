-- Login también por correo: cada challenge es de un teléfono (código enviado por WhatsApp) o de un correo (código tecleado).
alter table login_challenges alter column phone_e164 drop not null;
alter table login_challenges add column email text check (email = lower(email));
alter table login_challenges add constraint challenge_identity check ((phone_e164 is null) <> (email is null));
create index on login_challenges (email, created_at);
