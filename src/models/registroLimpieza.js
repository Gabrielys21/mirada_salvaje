const { query } = require('../config/db');
const { Filtro } = require('../utils/filtros');

const ESTADOS = { pendiente: 'Pendiente', completado: 'Completado' };

const SELECT_BASE = `
  SELECT r.id, r.fecha, r.estado, r.observaciones, r.created_at,
         r.area_id, a.nombre AS area_nombre, a.tipo AS area_tipo,
         r.encargado_id, u.nombre AS encargado_nombre
    FROM registros_limpieza r
    JOIN areas a ON a.id = r.area_id
    JOIN usuarios u ON u.id = r.encargado_id`;

function construirFiltro({ desde, hasta, areaId, estado, encargadoId } = {}) {
  return new Filtro()
    .agregar('r.fecha >= ?', desde)
    .agregar('r.fecha <= ?', hasta)
    .agregar('r.area_id = ?', areaId)
    .agregar('r.estado = ?', estado)
    .agregar('r.encargado_id = ?', encargadoId);
}

async function listar(filtros = {}, { limite = 500 } = {}) {
  const f = construirFiltro(filtros);
  f.parametros.push(limite);
  const { rows } = await query(
    `${SELECT_BASE} ${f.sql} ORDER BY r.fecha DESC, a.nombre, r.id DESC LIMIT $${f.parametros.length}`,
    f.parametros,
  );
  return rows;
}

async function buscarPorId(id) {
  const { rows } = await query(`${SELECT_BASE} WHERE r.id = $1`, [id]);
  return rows[0] || null;
}

async function crear({ areaId, fecha, encargadoId, estado, observaciones }) {
  const { rows } = await query(
    `INSERT INTO registros_limpieza (area_id, fecha, encargado_id, estado, observaciones)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [areaId, fecha, encargadoId, estado, observaciones || null],
  );
  return rows[0];
}

async function actualizar(id, { areaId, fecha, encargadoId, estado, observaciones }) {
  const { rowCount } = await query(
    `UPDATE registros_limpieza
        SET area_id = $2, fecha = $3, encargado_id = $4, estado = $5, observaciones = $6
      WHERE id = $1`,
    [id, areaId, fecha, encargadoId, estado, observaciones || null],
  );
  return rowCount > 0;
}

async function cambiarEstado(id, estado) {
  const { rowCount } = await query('UPDATE registros_limpieza SET estado = $2 WHERE id = $1', [id, estado]);
  return rowCount > 0;
}

async function eliminar(id) {
  const { rowCount } = await query('DELETE FROM registros_limpieza WHERE id = $1', [id]);
  return rowCount > 0;
}

// Totales por área para el reporte.
async function resumenPorArea(filtros = {}) {
  const f = construirFiltro(filtros);
  const { rows } = await query(
    `SELECT a.id, a.nombre, a.tipo,
            COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE r.estado = 'completado')::int AS completados,
            COUNT(*) FILTER (WHERE r.estado = 'pendiente')::int AS pendientes
       FROM registros_limpieza r
       JOIN areas a ON a.id = r.area_id
      ${f.sql}
      GROUP BY a.id, a.nombre, a.tipo
      ORDER BY a.tipo, a.nombre`,
    f.parametros,
  );
  return rows;
}

async function contarPendientes({ hasta, encargadoId } = {}) {
  const f = new Filtro()
    .agregar('r.estado = ?', 'pendiente')
    .agregar('r.fecha <= ?', hasta)
    .agregar('r.encargado_id = ?', encargadoId);
  const { rows } = await query(`SELECT COUNT(*)::int AS total FROM registros_limpieza r ${f.sql}`, f.parametros);
  return rows[0].total;
}

module.exports = {
  ESTADOS,
  listar,
  buscarPorId,
  crear,
  actualizar,
  cambiarEstado,
  eliminar,
  resumenPorArea,
  contarPendientes,
};
