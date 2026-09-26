-- Esquema inicial del sistema Mirada Salvaje.

-- ============ Usuarios ============
CREATE TABLE usuarios (
  id            SERIAL PRIMARY KEY,
  nombre        VARCHAR(100) NOT NULL,
  username      VARCHAR(50)  NOT NULL UNIQUE,
  password_hash VARCHAR(100) NOT NULL,
  rol           VARCHAR(20)  NOT NULL CHECK (rol IN ('admin', 'empleado')),
  activo        BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE  usuarios IS 'Personas con acceso al sistema';
COMMENT ON COLUMN usuarios.username IS 'Nombre de usuario para iniciar sesión (en minúsculas)';
COMMENT ON COLUMN usuarios.password_hash IS 'Hash bcrypt de la contraseña';
COMMENT ON COLUMN usuarios.rol IS 'admin | empleado';

-- ============ Limpieza ============
CREATE TABLE areas (
  id          SERIAL PRIMARY KEY,
  nombre      VARCHAR(100) NOT NULL UNIQUE,
  tipo        VARCHAR(20)  NOT NULL CHECK (tipo IN ('jaula', 'sanitario', 'jardin', 'area_juegos', 'oficina')),
  descripcion VARCHAR(255),
  activo      BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE  areas IS 'Espacios físicos del zoológico que requieren limpieza';
COMMENT ON COLUMN areas.tipo IS 'jaula | sanitario | jardin | area_juegos | oficina';

CREATE TABLE registros_limpieza (
  id            SERIAL PRIMARY KEY,
  area_id       INTEGER      NOT NULL REFERENCES areas (id) ON DELETE RESTRICT,
  fecha         DATE         NOT NULL,
  encargado_id  INTEGER      NOT NULL REFERENCES usuarios (id) ON DELETE RESTRICT,
  estado        VARCHAR(20)  NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'completado')),
  observaciones VARCHAR(500),
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_registros_limpieza_fecha ON registros_limpieza (fecha);
CREATE INDEX idx_registros_limpieza_area ON registros_limpieza (area_id);
COMMENT ON TABLE  registros_limpieza IS 'Tareas de limpieza asignadas a un área en una fecha';
COMMENT ON COLUMN registros_limpieza.encargado_id IS 'Usuario responsable de la limpieza';
COMMENT ON COLUMN registros_limpieza.estado IS 'pendiente | completado';

-- ============ Animales y alimentación ============
CREATE TABLE animales (
  id               SERIAL PRIMARY KEY,
  nombre           VARCHAR(100) NOT NULL,
  especie          VARCHAR(100) NOT NULL,
  sexo             CHAR(1)      CHECK (sexo IN ('M', 'H')),
  fecha_nacimiento DATE,
  area_id          INTEGER      REFERENCES areas (id) ON DELETE SET NULL,
  observaciones    VARCHAR(500),
  activo           BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE  animales IS 'Catálogo de animales del zoológico';
COMMENT ON COLUMN animales.sexo IS 'M = macho, H = hembra, NULL = no determinado';
COMMENT ON COLUMN animales.area_id IS 'Jaula o hábitat donde vive el animal';

CREATE TABLE inventario_alimentos (
  id           SERIAL PRIMARY KEY,
  nombre       VARCHAR(100)  NOT NULL UNIQUE,
  tipo         VARCHAR(20)   NOT NULL CHECK (tipo IN ('carne', 'pescado', 'fruta', 'verdura', 'grano', 'concentrado', 'otro')),
  unidad       VARCHAR(10)   NOT NULL CHECK (unidad IN ('kg', 'lb', 'litro', 'unidad')),
  stock        NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (stock >= 0),
  stock_minimo NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (stock_minimo >= 0),
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE  inventario_alimentos IS 'Alimentos en bodega con su existencia actual';
COMMENT ON COLUMN inventario_alimentos.stock_minimo IS 'Por debajo de este valor se muestra alerta';

CREATE TABLE movimientos_inventario (
  id            SERIAL PRIMARY KEY,
  alimento_id   INTEGER       NOT NULL REFERENCES inventario_alimentos (id) ON DELETE RESTRICT,
  tipo          VARCHAR(10)   NOT NULL CHECK (tipo IN ('entrada', 'salida')),
  cantidad      NUMERIC(10,2) NOT NULL CHECK (cantidad > 0),
  fecha         DATE          NOT NULL DEFAULT CURRENT_DATE,
  usuario_id    INTEGER       NOT NULL REFERENCES usuarios (id) ON DELETE RESTRICT,
  observaciones VARCHAR(255),
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_movimientos_inventario_fecha ON movimientos_inventario (fecha);
COMMENT ON TABLE movimientos_inventario IS 'Entradas y salidas de stock de alimentos';

CREATE TABLE dietas (
  id            SERIAL PRIMARY KEY,
  animal_id     INTEGER       NOT NULL REFERENCES animales (id) ON DELETE CASCADE,
  alimento_id   INTEGER       NOT NULL REFERENCES inventario_alimentos (id) ON DELETE RESTRICT,
  cantidad      NUMERIC(10,2) NOT NULL CHECK (cantidad > 0),
  horario       TIME          NOT NULL,
  observaciones VARCHAR(255),
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_dietas_animal ON dietas (animal_id);
COMMENT ON TABLE  dietas IS 'Raciones programadas por animal';
COMMENT ON COLUMN dietas.cantidad IS 'Cantidad por ración, en la unidad del alimento';

-- ============ Control clínico ============
CREATE TABLE registros_clinicos (
  id               SERIAL PRIMARY KEY,
  animal_id        INTEGER      NOT NULL REFERENCES animales (id) ON DELETE RESTRICT,
  tipo             VARCHAR(20)  NOT NULL CHECK (tipo IN ('medicamento', 'vacuna', 'vitamina')),
  producto         VARCHAR(100) NOT NULL,
  dosis            VARCHAR(50)  NOT NULL,
  fecha_aplicacion DATE         NOT NULL,
  proxima_fecha    DATE         CHECK (proxima_fecha IS NULL OR proxima_fecha >= fecha_aplicacion),
  registrado_por   INTEGER      NOT NULL REFERENCES usuarios (id) ON DELETE RESTRICT,
  observaciones    VARCHAR(500),
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_registros_clinicos_animal ON registros_clinicos (animal_id);
COMMENT ON TABLE  registros_clinicos IS 'Historial de medicamentos, vacunas y vitaminas aplicados';
COMMENT ON COLUMN registros_clinicos.proxima_fecha IS 'Siguiente aplicación, si el tratamiento la requiere';

-- ============ Entradas y promociones ============
CREATE TABLE tipos_entrada (
  id          SERIAL PRIMARY KEY,
  nombre      VARCHAR(50)   NOT NULL UNIQUE,
  precio      NUMERIC(10,2) NOT NULL CHECK (precio >= 0),
  descripcion VARCHAR(255),
  activo      BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE tipos_entrada IS 'Tarifas de ingreso (general, estudiante, niño, etc.)';

CREATE TABLE promociones (
  id                   SERIAL PRIMARY KEY,
  nombre               VARCHAR(100) NOT NULL,
  descripcion          VARCHAR(255),
  porcentaje_descuento NUMERIC(5,2) NOT NULL CHECK (porcentaje_descuento > 0 AND porcentaje_descuento <= 100),
  fecha_inicio         DATE         NOT NULL,
  fecha_fin            DATE         NOT NULL,
  tipo_entrada_id      INTEGER      REFERENCES tipos_entrada (id) ON DELETE CASCADE,
  activo               BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CHECK (fecha_fin >= fecha_inicio)
);
COMMENT ON TABLE  promociones IS 'Descuentos con vigencia';
COMMENT ON COLUMN promociones.tipo_entrada_id IS 'Tipo de entrada al que aplica; NULL = todos';

CREATE TABLE ventas_entrada (
  id                   SERIAL PRIMARY KEY,
  fecha                TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  tipo_entrada_id      INTEGER       NOT NULL REFERENCES tipos_entrada (id) ON DELETE RESTRICT,
  promocion_id         INTEGER       REFERENCES promociones (id) ON DELETE SET NULL,
  cantidad             INTEGER       NOT NULL CHECK (cantidad > 0),
  precio_unitario      NUMERIC(10,2) NOT NULL CHECK (precio_unitario >= 0),
  porcentaje_descuento NUMERIC(5,2)  NOT NULL DEFAULT 0 CHECK (porcentaje_descuento >= 0 AND porcentaje_descuento <= 100),
  total                NUMERIC(12,2) NOT NULL CHECK (total >= 0),
  vendedor_id          INTEGER       NOT NULL REFERENCES usuarios (id) ON DELETE RESTRICT
);
CREATE INDEX idx_ventas_entrada_fecha ON ventas_entrada (fecha);
COMMENT ON TABLE  ventas_entrada IS 'Ventas de boletos de ingreso';
COMMENT ON COLUMN ventas_entrada.precio_unitario IS 'Precio del tipo de entrada al momento de la venta';
COMMENT ON COLUMN ventas_entrada.porcentaje_descuento IS 'Descuento aplicado al momento de la venta';
