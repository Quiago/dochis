-- Datos ficticios (del prototipo). Teléfonos, correos y licencias inventados.
insert into doctors (slug, full_name, specialty, clinic, area, emirate, languages, insurances, regulator,
  license_number, phone_e164, public_whatsapp, email, status, consent_at, last_confirmed_at)
select slug, full_name, specialty, clinic, area, emirate, languages, insurances, regulator::regulator,
  license, phone, case when wa then phone end, email, status::doctor_status,
  case when status <> 'unclaimed' then now() - interval '1 year' end,
  case when status <> 'unclaimed' then now() - make_interval(days => days) end
from (values
  ('dra-lucia-marquez-ortega', 'Dra. Lucía Márquez Ortega', 'Pediatría', 'Clínica Palmera Kids', 'Jumeirah', 'Dubái', '{Español,Inglés}'::text[], '{Daman,AXA}'::text[], 'DHA', 'DHA-10001', '+971500000001', true, 'lucia@example.com', 'verified', 12),
  ('dr-andres-villalba', 'Dr. Andrés Villalba', 'Traumatología', 'Hospital Arena Norte', 'Dubai Marina', 'Dubái', '{Español,Inglés,Árabe}', '{Bupa,Daman}', 'DHA', 'DHA-10002', '+971500000002', true, 'andres@example.com', 'verified', 40),
  ('dra-camila-restrepo', 'Dra. Camila Restrepo', 'Ginecología', 'Centro Médico Oasis', 'Al Reem', 'Abu Dabi', '{Español,Inglés}', '{Thiqa,Daman}', 'DOH', 'DOH-20001', '+971500000003', true, 'camila@example.com', 'verified', 5),
  ('dr-javier-soler-pons', 'Dr. Javier Soler Pons', 'Medicina familiar', 'Clínica Duna', 'JLT', 'Dubái', '{Español,Catalán,Inglés}', '{AXA,Cigna}', 'DHA', 'DHA-10003', '+971500000004', false, 'javier@example.com', 'stale', 120),
  ('dra-valentina-ibarra', 'Dra. Valentina Ibarra', 'Dermatología', 'Skin Lab Coral', 'Business Bay', 'Dubái', '{Español,Inglés,Italiano}', '{Cigna}', 'DHA', 'DHA-10004', '+971500000005', true, 'valentina@example.com', 'verified', 22),
  ('dr-omar-haddad', 'Dr. Omar Haddad', 'Cardiología', 'Hospital Brisa del Golfo', 'Al Majaz', 'Sharjah', '{Árabe,Español,Inglés}', '{Daman,Bupa}', 'MOHAP', 'MOH-30001', '+971500000006', false, 'omar@example.com', 'verified', 60),
  ('dra-florencia-paz', 'Dra. Florencia Paz', 'Psicología', 'Espacio Mente Clara', 'Al Barsha', 'Dubái', '{Español,Inglés}', '{"Pago directo"}', 'DHA', 'DHA-10005', '+971500000007', true, 'florencia@example.com', 'verified', 3),
  ('dr-mateo-guzman', 'Dr. Mateo Guzmán', 'Odontología', 'Sonrisa Azul Dental', 'Khalifa City', 'Abu Dabi', '{Español,Inglés}', '{Thiqa,AXA}', 'DOH', 'DOH-20002', '+971500000008', true, 'mateo@example.com', 'stale', 150),
  ('dra-nadia-farouk', 'Dra. Nadia Farouk', 'Pediatría', 'Hospital Brisa del Golfo', 'Al Majaz', 'Sharjah', '{Árabe,Inglés,Español}', '{Daman}', 'MOHAP', 'MOH-30002', '+971500000009', true, 'nadia@example.com', 'verified', 30),
  ('dr-sebastian-rojas', 'Dr. Sebastián Rojas', 'Oftalmología', 'Visión Clara Center', 'Healthcare City', 'Dubái', '{Español,Inglés}', '{Bupa,Cigna,AXA}', 'DHA', 'DHA-10006', '+971500000010', true, 'sebastian@example.com', 'verified', 75),
  ('dra-ines-carrasco', 'Dra. Inés Carrasco', 'Endocrinología', 'Clínica Palmera', 'Jumeirah', 'Dubái', '{Español,Francés,Inglés}', '{AXA,Daman}', 'DHA', 'DHA-10007', '+971500000011', true, 'ines@example.com', 'verified', 18),
  -- verified pero con 95 días: se muestra "Pendiente" por estado efectivo (antes del cron)
  ('dr-tomas-aguirre', 'Dr. Tomás Aguirre', 'Medicina familiar', 'Centro Médico Oasis', 'Al Reem', 'Abu Dabi', '{Español,Inglés}', '{Thiqa}', 'DOH', 'DOH-20003', '+971500000012', false, 'tomas@example.com', 'verified', 95),
  ('dra-paula-echeverri', 'Dra. Paula Echeverri', 'Neurología', 'Hospital Arena Norte', 'Dubai Marina', 'Dubái', '{Español}', '{Daman}', null, null, '+971500000013', false, null, 'unclaimed', 0),
  ('dr-rafael-montoya', 'Dr. Rafael Montoya', 'Urología', 'Centro Médico Oasis', 'Al Reem', 'Abu Dabi', '{}', '{}', null, null, null, false, null, 'unclaimed', 0),
  -- nunca públicos
  ('dr-oculto-pendiente', 'Dr. Oculto Pendiente', 'Pediatría', 'Clínica Secreta', 'Jumeirah', 'Dubái', '{Español}', '{Daman}', 'DHA', 'DHA-99998', '+971500000098', true, 'pendiente@example.com', 'pending_verification', 1),
  ('dra-oculta-hidden', 'Dra. Oculta Hidden', 'Pediatría', 'Clínica Secreta', 'Jumeirah', 'Dubái', '{Español}', '{Daman}', 'DHA', 'DHA-99999', '+971500000099', true, 'hidden@example.com', 'hidden', 200)
) as t(slug, full_name, specialty, clinic, area, emirate, languages, insurances, regulator, license, phone, wa, email, status, days);

-- Historial: una confirmación cada ~3 meses hacia atrás desde la última.
insert into confirmations (doctor_id, confirmed_at)
select d.id, d.last_confirmed_at - make_interval(days => 91 * n)
from doctors d, generate_series(0, 3) n
where d.last_confirmed_at is not null;
