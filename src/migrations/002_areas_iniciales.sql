-- Un área de ejemplo por cada tipo, para empezar a registrar limpiezas.
INSERT INTO areas (nombre, tipo, descripcion) VALUES
  ('Jaula de felinos',        'jaula',       'Recinto de leones y jaguares'),
  ('Sanitarios principales',  'sanitario',   'Sanitarios junto a la entrada'),
  ('Jardín central',          'jardin',      'Área verde frente al lago'),
  ('Área de juegos infantil', 'area_juegos', 'Juegos para niños'),
  ('Oficinas administrativas','oficina',     'Edificio administrativo')
ON CONFLICT (nombre) DO NOTHING;
