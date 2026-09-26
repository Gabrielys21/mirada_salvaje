const { query } = require('../config/db');

async function listar({ soloActivos = false } = {}) {
  const { rows } = await query(
    `SELECT t.*, (SELECT COUNT(*)::int FROM ventas_entrada v WHERE v.tipo_entrada_id = t.id) AS total_ventas
       FROM tipos_entrada t
      ${soloActivos ? 'WHERE t.activo' : ''}
      ORDER BY t.activo DESC, t.precio DESC, t.nombre`,
  );
  return rows;
}

// Tipos activos con la mejor promoción vigente en `fecha` y el precio final por boleto.
async function listarConPrecioDelDia(fecha) {
  const { rows } = await query(
    `SELECT t.id, t.nombre, t.precio, t.descripcion,
            p.id AS promocion_id, p.nombre AS promocion_nombre,
            COALESCE(p.porcentaje_descuento, 0) AS porcentaje_descuento,
            ROUND(t.precio * (100 - COALESCE(p.porcentaje_descuento, 0)) / 100, 2) AS precio_final
       FROM tipos_entrada t
       LEFT JOIN LATERAL (
         SELECT pr.id, pr.nombre, pr.porcentaje_descuento
           FROM promociones pr
          WHERE pr.activo AND $1::date BETWEEN pr.fecha_inicio AND pr.fecha_fin
            AND (pr.tipo_entrada_id IS NULL OR pr.tipo_entrada_id = t.id)
          ORDER BY pr.porcentaje_descuento DESC, pr.id
          LIMIT 1
       ) p ON TRUE
      WHERE t.activo
      ORDER BY t.precio DESC, t.nombre`,
    [fecha],
  );
  return rows;
}

async function buscarPorId(id) {
  const { rows } = await query('SELECT * FROM tipos_entrada WHERE id = $1', [id]);
  return rows[0] || null;
}

async function crear({ nombre, precio, descripcion }) {
  const { rows } = await query(
    'INSERT INTO tipos_entrada (nombre, precio, descripcion) VALUES ($1, $2, $3) RETURNING id',
    [nombre, precio, descripcion || null],
  );
  return rows[0];
}

async function actualizar(id, { nombre, precio, descripcion, activo }) {
  const { rowCount } = await query(
    'UPDATE tipos_entrada SET nombre = $2, precio = $3, descripcion = $4, activo = $5 WHERE id = $1',
    [id, nombre, precio, descripcion || null, activo],
  );
  return rowCount > 0;
}

// Elimina también las promociones exclusivas del tipo (ON DELETE CASCADE); falla si tiene ventas.
async function eliminar(id) {
  const { rowCount } = await query('DELETE FROM tipos_entrada WHERE id = $1', [id]);
  return rowCount > 0;
}

module.exports = {
  listar, listarConPrecioDelDia, buscarPorId, crear, actualizar, eliminar,
};
