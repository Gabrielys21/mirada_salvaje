const { query } = require('../config/db');
const { Filtro } = require('../utils/filtros');
const { ErrorNegocio } = require('../utils/validacion');
const { ZONA_HORARIA } = require('../utils/helpers');

// Fecha local (Guatemala) de la venta, para filtrar y agrupar por día.
const FECHA_LOCAL = `(v.fecha AT TIME ZONE '${ZONA_HORARIA}')::date`;

const SELECT_BASE = `
  SELECT v.id, v.fecha, ${FECHA_LOCAL}::text AS fecha_local, v.cantidad, v.precio_unitario, v.porcentaje_descuento, v.total,
         ROUND(v.precio_unitario * v.cantidad - v.total, 2) AS descuento,
         v.tipo_entrada_id, t.nombre AS tipo_entrada_nombre,
         v.promocion_id, p.nombre AS promocion_nombre,
         v.vendedor_id, u.nombre AS vendedor_nombre
    FROM ventas_entrada v
    JOIN tipos_entrada t ON t.id = v.tipo_entrada_id
    LEFT JOIN promociones p ON p.id = v.promocion_id
    JOIN usuarios u ON u.id = v.vendedor_id`;

function construirFiltro({ desde, hasta, tipoEntradaId, vendedorId } = {}) {
  return new Filtro()
    .agregar(`${FECHA_LOCAL} >= ?`, desde)
    .agregar(`${FECHA_LOCAL} <= ?`, hasta)
    .agregar('v.tipo_entrada_id = ?', tipoEntradaId)
    .agregar('v.vendedor_id = ?', vendedorId);
}

async function listar(filtros = {}, { limite = 500 } = {}) {
  const f = construirFiltro(filtros);
  f.parametros.push(limite);
  const { rows } = await query(
    `${SELECT_BASE} ${f.sql} ORDER BY v.fecha DESC, v.id DESC LIMIT $${f.parametros.length}`,
    f.parametros,
  );
  return rows;
}

async function buscarPorId(id) {
  const { rows } = await query(`${SELECT_BASE} WHERE v.id = $1`, [id]);
  return rows[0] || null;
}

// Registra la venta tomando el precio actual del tipo y la mejor promoción vigente en `hoy`.
// Todo el cálculo ocurre en una sola sentencia con aritmética decimal exacta de PostgreSQL.
async function registrar({ tipoEntradaId, cantidad, vendedorId, hoy }) {
  const { rows } = await query(
    `WITH t AS (
       SELECT id, precio FROM tipos_entrada WHERE id = $1 AND activo
     ), p AS (
       SELECT id, porcentaje_descuento
         FROM promociones
        WHERE activo AND $3::date BETWEEN fecha_inicio AND fecha_fin
          AND (tipo_entrada_id IS NULL OR tipo_entrada_id = $1)
        ORDER BY porcentaje_descuento DESC, id
        LIMIT 1
     )
     INSERT INTO ventas_entrada (tipo_entrada_id, promocion_id, cantidad, precio_unitario, porcentaje_descuento, total, vendedor_id)
     SELECT t.id, p.id, $2::int, t.precio, COALESCE(p.porcentaje_descuento, 0),
            ROUND(t.precio * $2::int * (100 - COALESCE(p.porcentaje_descuento, 0)) / 100, 2), $4
       FROM t LEFT JOIN p ON TRUE
     RETURNING id`,
    [tipoEntradaId, cantidad, hoy, vendedorId],
  );
  if (!rows.length) throw new ErrorNegocio('El tipo de entrada seleccionado no está disponible.');
  return rows[0];
}

async function eliminar(id) {
  const { rowCount } = await query('DELETE FROM ventas_entrada WHERE id = $1', [id]);
  return rowCount > 0;
}

// Totales del periodo y desgloses por día, tipo de entrada y promoción.
async function resumen(filtros = {}) {
  const f = construirFiltro(filtros);
  const agregados = `COUNT(*)::int AS ventas, COALESCE(SUM(v.cantidad), 0)::int AS boletos,
                     COALESCE(SUM(v.total), 0) AS ingresos,
                     COALESCE(SUM(v.precio_unitario * v.cantidad - v.total), 0) AS descuentos`;
  const [totales, porDia, porTipo, porPromocion] = await Promise.all([
    query(`SELECT ${agregados} FROM ventas_entrada v ${f.sql}`, f.parametros),
    query(
      `SELECT ${FECHA_LOCAL}::text AS dia, ${agregados} FROM ventas_entrada v ${f.sql} GROUP BY 1 ORDER BY 1`,
      f.parametros,
    ),
    query(
      `SELECT t.nombre, ${agregados} FROM ventas_entrada v JOIN tipos_entrada t ON t.id = v.tipo_entrada_id
        ${f.sql} GROUP BY t.id, t.nombre ORDER BY ingresos DESC`,
      f.parametros,
    ),
    query(
      `SELECT COALESCE(p.nombre, 'Sin promoción') AS nombre, ${agregados}
         FROM ventas_entrada v LEFT JOIN promociones p ON p.id = v.promocion_id
        ${f.sql} GROUP BY p.id, p.nombre ORDER BY (p.id IS NULL), ingresos DESC`,
      f.parametros,
    ),
  ]);
  return {
    totales: totales.rows[0], porDia: porDia.rows, porTipo: porTipo.rows, porPromocion: porPromocion.rows,
  };
}

module.exports = {
  listar, buscarPorId, registrar, eliminar, resumen,
};
