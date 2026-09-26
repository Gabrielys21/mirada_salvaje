const { query } = require('../config/db');
const { Filtro } = require('../utils/filtros');

const ESTADOS = {
  vigente: 'Vigente', programada: 'Programada', vencida: 'Vencida', inactiva: 'Inactiva',
};

// $1 siempre es la fecha de referencia (hoy) para calcular el estado.
const SELECT_BASE = `
  SELECT p.*, t.nombre AS tipo_entrada_nombre,
         CASE WHEN NOT p.activo THEN 'inactiva'
              WHEN $1::date < p.fecha_inicio THEN 'programada'
              WHEN $1::date > p.fecha_fin THEN 'vencida'
              ELSE 'vigente' END AS estado,
         (SELECT COUNT(*)::int FROM ventas_entrada v WHERE v.promocion_id = p.id) AS total_ventas
    FROM promociones p
    LEFT JOIN tipos_entrada t ON t.id = p.tipo_entrada_id`;

const CONDICIONES_ESTADO = {
  inactiva: 'NOT p.activo',
  programada: 'p.activo AND $1::date < p.fecha_inicio',
  vencida: 'p.activo AND $1::date > p.fecha_fin',
  vigente: 'p.activo AND $1::date BETWEEN p.fecha_inicio AND p.fecha_fin',
};

async function listar({ hoy, estado } = {}) {
  const f = new Filtro();
  f.parametros.push(hoy);
  if (Object.hasOwn(CONDICIONES_ESTADO, estado)) f.condiciones.push(CONDICIONES_ESTADO[estado]);
  const { rows } = await query(`${SELECT_BASE} ${f.sql} ORDER BY p.fecha_inicio DESC, p.id DESC`, f.parametros);
  return rows;
}

async function contarVigentes(hoy) {
  const { rows } = await query(
    `SELECT COUNT(*)::int AS total FROM promociones p WHERE ${CONDICIONES_ESTADO.vigente}`,
    [hoy],
  );
  return rows[0].total;
}

async function buscarPorId(id, hoy) {
  const { rows } = await query(`${SELECT_BASE} WHERE p.id = $2`, [hoy, id]);
  return rows[0] || null;
}

async function crear({ nombre, descripcion, porcentajeDescuento, fechaInicio, fechaFin, tipoEntradaId }) {
  const { rows } = await query(
    `INSERT INTO promociones (nombre, descripcion, porcentaje_descuento, fecha_inicio, fecha_fin, tipo_entrada_id)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [nombre, descripcion || null, porcentajeDescuento, fechaInicio, fechaFin, tipoEntradaId || null],
  );
  return rows[0];
}

async function actualizar(id, { nombre, descripcion, porcentajeDescuento, fechaInicio, fechaFin, tipoEntradaId, activo }) {
  const { rowCount } = await query(
    `UPDATE promociones
        SET nombre = $2, descripcion = $3, porcentaje_descuento = $4, fecha_inicio = $5, fecha_fin = $6,
            tipo_entrada_id = $7, activo = $8
      WHERE id = $1`,
    [id, nombre, descripcion || null, porcentajeDescuento, fechaInicio, fechaFin, tipoEntradaId || null, activo],
  );
  return rowCount > 0;
}

// Solo se eliminan promociones sin ventas, para no perder el rastro en el historial de ventas.
async function eliminar(id) {
  const { rowCount } = await query(
    'DELETE FROM promociones p WHERE p.id = $1 AND NOT EXISTS (SELECT 1 FROM ventas_entrada v WHERE v.promocion_id = p.id)',
    [id],
  );
  return rowCount > 0;
}

module.exports = {
  ESTADOS, listar, contarVigentes, buscarPorId, crear, actualizar, eliminar,
};
