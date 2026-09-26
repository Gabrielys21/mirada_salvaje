# Brief técnico — Sistema de Control del Zoológico "Mirada Salvaje"

Proyecto de Análisis de Sistemas II (Universidad Mariano Gálvez). Entrega: 26/09/2026, medianoche.

## Stack

- Backend: Node.js + Express
- Base de datos: PostgreSQL
- Vistas: EJS (server-side rendering, un solo proyecto)
- Seguridad: bcrypt (contraseñas), express-session (sesiones), variables de entorno para credenciales, validación de inputs en cada formulario
- Hosting: Render.com (Web Service + PostgreSQL, ambos free tier)

## Estructura de carpetas

La raíz del repo (`C:\PROYECTO_ANALISIS_SISTEMAS_II`) es la carpeta `zoologico-mirada-salvaje/` del brief.

```
├── src/
│   ├── config/db.js          # Pool de pg
│   ├── config/migrate.js     # Ejecuta src/migrations/*.sql en orden (al arrancar y con npm run migrate)
│   ├── config/bootstrap.js   # Crea el admin inicial desde ADMIN_USERNAME/ADMIN_PASSWORD si no hay usuarios
│   ├── migrations/           # SQL numerado; nunca editar una migración ya aplicada, crear una nueva
│   ├── models/               # Funciones de acceso a datos (SQL parametrizado)
│   ├── controllers/
│   ├── routes/
│   ├── middlewares/auth.js   # requireAuth, requireRole
│   ├── utils/
│   └── app.js
├── views/                    # EJS; partials/ se resuelve desde cualquier subcarpeta
├── public/
├── .env                      # NO se versiona
├── package.json
└── render.yaml
```

## Módulos requeridos

### 1. Autenticación y roles
- Login con contraseña hasheada (bcrypt)
- Roles: admin, empleado
- Middleware que protege rutas según rol

### 2. Gestión de Limpieza
- Áreas: jaulas, sanitarios, jardines, área de juegos, oficinas
- Registro de limpieza: área, fecha, encargado, estado (pendiente/completado)
- Reporte de limpieza por rango de fechas

### 3. Gestión de Alimentación
- Animales (catálogo básico)
- Dietas por animal (tipo de alimento, cantidad, horario)
- Inventario de alimentos con stock (entradas y salidas)
- Alerta simple cuando el stock baja de un mínimo

### 4. Control Clínico
- Registro de medicamentos, vacunas y vitaminas por animal
- Fecha de aplicación y próxima fecha (si aplica)
- Historial clínico por animal

### 5. Gestión de Entradas y Promociones
- Tipos de entrada (general, estudiante, niño, etc.) con precio
- Promociones activas (descuento, vigencia)
- Registro simple de venta de entradas

### 6. Reportes
- Al menos un reporte por módulo (tabla filtrable o export simple)

## Modelo de datos (entidades mínimas)

Usuario, Animal, Area, RegistroLimpieza, Dieta, InventarioAlimento,
RegistroClinico, TipoEntrada, Promocion, VentaEntrada
(+ MovimientoInventario para las entradas/salidas de stock)

Cada entidad debe pasar directo al modelo entidad-relación y al
diccionario de datos que pide el documento final.

## Deploy en Render (checklist)

1. Repo en GitHub
2. Render → New Web Service → conectar repo
   - Build command: `npm install`
   - Start command: `node src/app.js`
3. Render → New PostgreSQL (free)
4. Copiar la connection string al Web Service como variable de entorno
   (`DATABASE_URL`)
5. Deploy, probar login y cada módulo, y dejar la URL lista para
   la demo en clase

## Convenciones del código

- Idioma del dominio: español (tablas, columnas, funciones de modelos, vistas).
- Tablas en plural snake_case (`registros_limpieza`); SQL siempre parametrizado ($1, $2…).
- Cada módulo sigue el patrón de Limpieza: modelo → controlador → rutas con reglas de express-validator → vistas EJS en `views/<modulo>/`.
- Formularios: POST con campo oculto `_csrf`; los borrados usan `data-confirm`.
- Nunca escribir valores reales de variables de entorno en archivos versionados; si hace falta uno, pedírselo al usuario (él lo pega en su `.env`, no en el chat).
