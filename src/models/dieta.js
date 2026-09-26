const { query } = require('../config/db');
const { Filtro } = require('../utils/filtros');

const SELECT_BASE = `
  SELECT d.id, d.cantidad, d.horario, d.observaciones,
         d.animal_id, an.nombre AS animal_nombre, an.especie, an.activo AS animal_activo,
         d.alimento_id, ia.nombre AS alimento_nombre, ia.tipo AS alimento_tipo, ia.unidad
    FROM dietas d
    JOIN animales an ON an.id = d.animal_id
    JOIN inventario_alimentos ia ON ia.id = d.alimento_id`;

async function listar({ animalId, alimentoId } = {}) {
  const f = new Filtro()
    .agregar('d.animal_id = ?', animalId)
    .agregar('d.alimento_id = ?', alimentoId);
  const { rows } = await query(
    `${SELECT_BASE} ${f.sql} ORDER BY an.activo DESC, an.especie, an.nombre, d.horario`,
    f.parametros,
  );
  return rows;
}

async function buscarPorId(id) {
  const { rows } = await query(`${SELECT_BASE} WHERE d.id = $1`, [id]);
  return rows[0] || null;
}

async function crear({ animalId, alimentoId, cantidad, horario, observaciones }) {
  const { rows } = await query(
    `INSERT INTO dietas (animal_id, alimento_id, cantidad, horario, observaciones)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [animalId, alimentoId, cantidad, horario, observaciones || null],
  );
  return rows[0];
}

async function actualizar(id, { animalId, alimentoId, cantidad, horario, observaciones }) {
  const { rowCount } = await query(
    `UPDATE dietas SET animal_id = $2, alimento_id = $3, cantidad = $4, horario = $5, observaciones = $6
      WHERE id = $1`,
    [id, animalId, alimentoId, cantidad, horario, observaciones || null],
  );
  return rowCount > 0;
}

async function eliminar(id) {
  const { rowCount } = await query('DELETE FROM dietas WHERE id = $1', [id]);
  return rowCount > 0;
}

module.exports = { listar, buscarPorId, crear, actualizar, eliminar };
