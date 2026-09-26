const { query } = require('../config/db');
const { Filtro } = require('../utils/filtros');

const TIPOS = { medicamento: 'Medicamento', vacuna: 'Vacuna', vitamina: 'Vitamina' };

const SELECT_BASE = `
  SELECT r.id, r.tipo, r.producto, r.dosis, r.fecha_aplicacion, r.proxima_fecha, r.observaciones, r.created_at,
         r.animal_id, an.nombre AS animal_nombre, an.especie, an.activo AS animal_activo,
         r.registrado_por, u.nombre AS registrado_por_nombre
    FROM registros_clinicos r
    JOIN animales an ON an.id = r.animal_id
    JOIN usuarios u ON u.id = r.registrado_por`;

// Una aplicación está pendiente si tiene próxima fecha y es la última registrada de ese
// producto para ese animal (si ya se registró una posterior, la anterior quedó atendida).
const CONDICION_PENDIENTE = `
  r.proxima_fecha IS NOT NULL
  AND an.activo
  AND NOT EXISTS (
    SELECT 1 FROM registros_clinicos r2
     WHERE r2.animal_id = r.animal_id
       AND r2.tipo = r.tipo
       AND LOWER(TRIM(r2.producto)) = LOWER(TRIM(r.producto))
       AND (r2.fecha_aplicacion > r.fecha_aplicacion
            OR (r2.fecha_aplicacion = r.fecha_aplicacion AND r2.id > r.id)))`;

function construirFiltro({ desde, hasta, animalId, tipo, texto } = {}) {
  return new Filtro()
    .agregar('r.fecha_aplicacion >= ?', desde)
    .agregar('r.fecha_aplicacion <= ?', hasta)
    .agregar('r.animal_id = ?', animalId)
    .agregar('r.tipo = ?', tipo)
    .agregarTexto('r.producto ILIKE ?', texto);
}

async function listar(filtros = {}, { limite = 500 } = {}) {
  const f = construirFiltro(filtros);
  f.parametros.push(limite);
  const { rows } = await query(
    `${SELECT_BASE} ${f.sql} ORDER BY r.fecha_aplicacion DESC, r.id DESC LIMIT $${f.parametros.length}`,
    f.parametros,
  );
  return rows;
}

async function buscarPorId(id) {
  const { rows } = await query(`${SELECT_BASE} WHERE r.id = $1`, [id]);
  return rows[0] || null;
}

async function crear({ animalId, tipo, producto, dosis, fechaAplicacion, proximaFecha, registradoPor, observaciones }) {
  const { rows } = await query(
    `INSERT INTO registros_clinicos
       (animal_id, tipo, producto, dosis, fecha_aplicacion, proxima_fecha, registrado_por, observaciones)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
    [animalId, tipo, producto, dosis, fechaAplicacion, proximaFecha || null, registradoPor, observaciones || null],
  );
  return rows[0];
}

async function actualizar(id, { animalId, tipo, producto, dosis, fechaAplicacion, proximaFecha, observaciones }) {
  const { rowCount } = await query(
    `UPDATE registros_clinicos
        SET animal_id = $2, tipo = $3, producto = $4, dosis = $5, fecha_aplicacion = $6, proxima_fecha = $7, observaciones = $8
      WHERE id = $1`,
    [id, animalId, tipo, producto, dosis, fechaAplicacion, proximaFecha || null, observaciones || null],
  );
  return rowCount > 0;
}

async function eliminar(id) {
  const { rowCount } = await query('DELETE FROM registros_clinicos WHERE id = $1', [id]);
  return rowCount > 0;
}

// Aplicaciones pendientes (vencidas incluidas) con próxima fecha hasta `hasta`; sin `hasta`, todas.
async function pendientes({ hoy, hasta, animalId, tipo } = {}) {
  const f = new Filtro()
    .agregar('r.proxima_fecha <= ?', hasta)
    .agregar('r.animal_id = ?', animalId)
    .agregar('r.tipo = ?', tipo);
  f.condiciones.push(CONDICION_PENDIENTE);
  f.parametros.push(hoy);
  const { rows } = await query(
    `SELECT sub.*, (sub.proxima_fecha - $${f.parametros.length}::date) AS dias_restantes
       FROM (${SELECT_BASE} ${f.sql}) sub
      ORDER BY sub.proxima_fecha, sub.animal_nombre`,
    f.parametros,
  );
  return rows;
}

// Conteos para el dashboard: vencidas y las que vencen dentro de `dias`.
async function contarPendientes({ hoy, hasta }) {
  const { rows } = await query(
    `SELECT COUNT(*) FILTER (WHERE r.proxima_fecha < $1)::int AS vencidas,
            COUNT(*) FILTER (WHERE r.proxima_fecha BETWEEN $1 AND $2)::int AS proximas
       FROM registros_clinicos r
       JOIN animales an ON an.id = r.animal_id
      WHERE ${CONDICION_PENDIENTE}`,
    [hoy, hasta],
  );
  return rows[0];
}

module.exports = {
  TIPOS, listar, buscarPorId, crear, actualizar, eliminar, pendientes, contarPendientes,
};
