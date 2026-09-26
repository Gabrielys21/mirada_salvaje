const { query } = require('../config/db');

const TIPOS = {
  jaula: 'Jaula',
  sanitario: 'Sanitarios',
  jardin: 'Jardín',
  area_juegos: 'Área de juegos',
  oficina: 'Oficina',
};

async function listar({ soloActivas = false } = {}) {
  const { rows } = await query(
    `SELECT a.*, (SELECT COUNT(*)::int FROM registros_limpieza r WHERE r.area_id = a.id) AS total_registros
       FROM areas a
      ${soloActivas ? 'WHERE a.activo' : ''}
      ORDER BY a.activo DESC, a.tipo, a.nombre`,
  );
  return rows;
}

async function buscarPorId(id) {
  const { rows } = await query('SELECT * FROM areas WHERE id = $1', [id]);
  return rows[0] || null;
}

async function crear({ nombre, tipo, descripcion }) {
  const { rows } = await query(
    'INSERT INTO areas (nombre, tipo, descripcion) VALUES ($1, $2, $3) RETURNING *',
    [nombre, tipo, descripcion || null],
  );
  return rows[0];
}

async function actualizar(id, { nombre, tipo, descripcion, activo }) {
  const { rows } = await query(
    'UPDATE areas SET nombre = $2, tipo = $3, descripcion = $4, activo = $5 WHERE id = $1 RETURNING *',
    [id, nombre, tipo, descripcion || null, activo],
  );
  return rows[0] || null;
}

async function eliminar(id) {
  const { rowCount } = await query('DELETE FROM areas WHERE id = $1', [id]);
  return rowCount > 0;
}

module.exports = { TIPOS, listar, buscarPorId, crear, actualizar, eliminar };
