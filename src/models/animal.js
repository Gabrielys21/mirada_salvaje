const { query } = require('../config/db');
const { Filtro } = require('../utils/filtros');

const SEXOS = { M: 'Macho', H: 'Hembra' };

const SELECT_BASE = `
  SELECT an.*, a.nombre AS area_nombre,
         (SELECT COUNT(*)::int FROM dietas d WHERE d.animal_id = an.id) AS total_dietas
    FROM animales an
    LEFT JOIN areas a ON a.id = an.area_id`;

async function listar({ texto, areaId, activo } = {}) {
  const f = new Filtro()
    .agregarTexto('(an.nombre ILIKE ? OR an.especie ILIKE ?)', texto)
    .agregar('an.area_id = ?', areaId)
    .agregar('an.activo = ?', activo);
  const { rows } = await query(`${SELECT_BASE} ${f.sql} ORDER BY an.activo DESC, an.especie, an.nombre`, f.parametros);
  return rows;
}

async function listarActivos() {
  const { rows } = await query('SELECT id, nombre, especie FROM animales WHERE activo ORDER BY especie, nombre');
  return rows;
}

async function buscarPorId(id) {
  const { rows } = await query(`${SELECT_BASE} WHERE an.id = $1`, [id]);
  return rows[0] || null;
}

async function crear({ nombre, especie, sexo, fechaNacimiento, areaId, observaciones }) {
  const { rows } = await query(
    `INSERT INTO animales (nombre, especie, sexo, fecha_nacimiento, area_id, observaciones)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [nombre, especie, sexo || null, fechaNacimiento || null, areaId || null, observaciones || null],
  );
  return rows[0];
}

async function actualizar(id, { nombre, especie, sexo, fechaNacimiento, areaId, observaciones, activo }) {
  const { rowCount } = await query(
    `UPDATE animales
        SET nombre = $2, especie = $3, sexo = $4, fecha_nacimiento = $5, area_id = $6, observaciones = $7, activo = $8
      WHERE id = $1`,
    [id, nombre, especie, sexo || null, fechaNacimiento || null, areaId || null, observaciones || null, activo],
  );
  return rowCount > 0;
}

async function eliminar(id) {
  const { rowCount } = await query('DELETE FROM animales WHERE id = $1', [id]);
  return rowCount > 0;
}

module.exports = { SEXOS, listar, listarActivos, buscarPorId, crear, actualizar, eliminar };
