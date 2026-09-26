# Zoológico Mirada Salvaje — Sistema de control

Proyecto de Análisis de Sistemas II (UMG). Node.js 22 + Express + PostgreSQL + EJS.

Módulos: autenticación con roles, limpieza, alimentación (animales, dietas, inventario), control clínico y entradas/promociones, cada uno con su reporte (tabla filtrable, CSV e impresión).

## Ejecutar en local

1. Instala dependencias:
   ```bash
   npm install
   ```
2. Crea una base de datos vacía en PostgreSQL (por ejemplo `mirada_salvaje`), o usa la **External Database URL** de una base de Render.
3. Copia `.env.example` como `.env` y completa:
   - `DATABASE_URL`: cadena de conexión de tu base.
   - `SESSION_SECRET`: genera una con
     `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`
   - `ADMIN_USERNAME`, `ADMIN_PASSWORD` (mínimo 8 caracteres) y `ADMIN_NOMBRE`: el primer administrador, que se crea solo si la tabla de usuarios está vacía.
4. Arranca:
   ```bash
   npm start        # o: npm run dev  (reinicia al guardar cambios)
   ```
   Al iniciar se aplican automáticamente las migraciones de `src/migrations/` y se crea el administrador inicial.
5. Abre http://localhost:3000 e inicia sesión con el administrador.

## Deploy en Render

| Configuración | Valor |
|---|---|
| Runtime | Node (versión 22, tomada de `engines` en `package.json`) |
| Build command | `npm install` |
| Start command | `node src/app.js` |
| Health check path | `/healthz` |
| Plan | Free |

No hay pasos de migración aparte: al arrancar, `node src/app.js` crea o actualiza las tablas y luego abre el puerto.

### 1. Subir el código a GitHub

Crea un repositorio (puede ser privado) y sube el proyecto. `.gitignore` ya excluye `.env` y `node_modules/`; revisa con `git status` que `.env` **no** aparezca antes del primer commit.

### 2. Base de datos

Si ya creaste la base PostgreSQL en Render, úsala. Si no: **New → PostgreSQL**, plan *Free*, y anota la **región**.

### 3. Crear el Web Service

**Opción A: con el Blueprint (`render.yaml`)**

1. **New → Blueprint** y conecta el repositorio.
2. Render lee `render.yaml`, crea el servicio y pide el valor de `DATABASE_URL` (ver paso 4).

**Opción B: manual**

1. **New → Web Service** y conecta el repositorio.
2. Elige la **misma región que la base de datos**.
3. Runtime *Node*, build `npm install`, start `node src/app.js`, plan *Free*.
4. En *Advanced → Health Check Path* escribe `/healthz`.

### 4. Variables de entorno (dashboard → servicio → *Environment*)

| Variable | Valor | Obligatoria |
|---|---|---|
| `DATABASE_URL` | **Internal Database URL** de la base (dashboard de la base → *Connections*). La interna solo funciona si el servicio y la base están en la misma región. | Sí |
| `SESSION_SECRET` | Cadena larga aleatoria. Con el Blueprint se genera sola; en la opción manual usa *Generate* o el comando de arriba. | Sí |
| `NODE_ENV` | `production` (activa cookies `Secure`). El Blueprint ya la define. | Sí |
| `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `ADMIN_NOMBRE` | Solo si la base está **vacía**, para crear el primer administrador. Después del primer arranque se pueden borrar. | No |
| `DATABASE_SSL` | Déjala sin definir. Solo si el log muestra un error de SSL al conectar, ponla en `false`. | No |

`PORT` no se configura: Render la asigna y la app la usa automáticamente.

### 5. Deploy y verificación

1. Lanza el deploy (*Manual Deploy → Deploy latest commit* si no arrancó solo).
2. En *Logs* deben aparecer `Migraciones aplicadas` (o nada si ya estaban aplicadas) y `Mirada Salvaje escuchando en el puerto …`.
3. Abre la URL `https://<servicio>.onrender.com`, inicia sesión y recorre cada módulo.

### Notas del plan gratuito

- El servicio se **duerme tras ~15 minutos sin tráfico**; la primera visita después tarda cerca de un minuto. Antes de la demo, abre la URL unos minutos antes.
- Las bases PostgreSQL gratuitas de Render **tienen fecha de expiración**; revísala en el dashboard de la base.

## Roles

| Acción | admin | empleado |
|---|---|---|
| Ver registros, áreas y reportes de limpieza | ✔ | ✔ |
| Crear registros de limpieza | ✔ (a cualquier encargado) | ✔ (a su nombre) |
| Editar / completar registros | ✔ todos | ✔ solo los suyos |
| Eliminar registros | ✔ | ✘ |
| Crear, editar y eliminar áreas | ✔ | ✘ |
| Ver animales, dietas, inventario, movimientos y reporte de alimentación | ✔ | ✔ |
| Registrar entradas y salidas de stock | ✔ | ✔ |
| Crear, editar y eliminar animales, dietas y alimentos | ✔ | ✘ |
| Anular movimientos de inventario (revierte el stock) | ✔ | ✘ |
| Ver historial clínico y próximas aplicaciones | ✔ | ✔ |
| Registrar aplicaciones (medicamento, vacuna, vitamina) | ✔ | ✔ |
| Editar registros clínicos | ✔ todos | ✔ solo los que registró |
| Eliminar registros clínicos | ✔ | ✘ |
| Ver tipos de entrada, promociones, ventas y reporte de ventas | ✔ | ✔ |
| Vender entradas | ✔ | ✔ |
| Crear, editar y eliminar tipos de entrada y promociones | ✔ | ✘ |
| Anular ventas | ✔ | ✘ |
| Gestionar usuarios | ✔ | ✘ |

## Reglas de negocio destacadas

- **Stock de alimentos:** solo cambia con movimientos de entrada/salida; no se permite una salida mayor al stock y se alerta cuando baja del mínimo.
- **Próximas aplicaciones clínicas:** una aplicación queda pendiente hasta que se registra una dosis posterior del mismo producto para el mismo animal.
- **Venta de entradas:** se aplica automáticamente la promoción vigente de mayor descuento (hora de Guatemala) que corresponda al tipo de entrada; la venta guarda el precio y el descuento del momento, así que cambiar precios no altera el historial.
- Lo que tiene historial (áreas, animales, tipos de entrada, promociones usadas) no se elimina: se desactiva.

## Base de datos

- Las tablas se definen en `src/migrations/*.sql` (con `COMMENT ON` para el diccionario de datos).
- `npm run migrate` aplica migraciones pendientes sin levantar el servidor.
- Para cambiar el esquema, crea un archivo nuevo numerado (`003_...sql`); no edites uno ya aplicado.
- Las sesiones se guardan en la tabla `sesiones` (se crea sola).
