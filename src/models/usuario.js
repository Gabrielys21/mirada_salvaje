const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { query } = require('../config/db');

const RONDAS_BCRYPT = 12;
const LONGITUD_MINIMA_PASSWORD = 8;
const ROLES = { admin: 'Administrador', empleado: 'Empleado' };
const CAMPOS = 'id, nombre, username, rol, activo, created_at';

// Hash de relleno: se compara aunque el usuario no exista, para no revelar por el
// tiempo de respuesta qué nombres de usuario están registrados.
const HASH_RELLENO = bcrypt.hashSync(crypto.randomBytes(16).toString('hex'), RONDAS_BCRYPT);

function normalizarUsername(username) {
  return String(username || '').trim().toLowerCase();
}

async function contar() {
  const { rows } = await query('SELECT COUNT(*)::int AS total FROM usuarios');
  return rows[0].total;
}

async function listar() {
  const { rows } = await query(`SELECT ${CAMPOS} FROM usuarios ORDER BY activo DESC, nombre`);
  return rows;
}

async function listarActivos() {
  const { rows } = await query(`SELECT ${CAMPOS} FROM usuarios WHERE activo ORDER BY nombre`);
  return rows;
}

async function buscarPorId(id) {
  const { rows } = await query(`SELECT ${CAMPOS} FROM usuarios WHERE id = $1`, [id]);
  return rows[0] || null;
}

// Devuelve el usuario si las credenciales son válidas y está activo; si no, null.
async function verificarCredenciales(username, password) {
  const { rows } = await query(
    `SELECT ${CAMPOS}, password_hash FROM usuarios WHERE username = $1`,
    [normalizarUsername(username)],
  );
  const usuario = rows[0];
  const coincide = await bcrypt.compare(String(password || ''), usuario ? usuario.password_hash : HASH_RELLENO);
  if (!usuario || !coincide || !usuario.activo) return null;
  delete usuario.password_hash;
  return usuario;
}

async function crear({ nombre, username, password, rol }) {
  const hash = await bcrypt.hash(password, RONDAS_BCRYPT);
  const { rows } = await query(
    `INSERT INTO usuarios (nombre, username, password_hash, rol) VALUES ($1, $2, $3, $4) RETURNING ${CAMPOS}`,
    [nombre.trim(), normalizarUsername(username), hash, rol],
  );
  return rows[0];
}

async function actualizar(id, { nombre, rol, activo }) {
  const { rows } = await query(
    `UPDATE usuarios SET nombre = $2, rol = $3, activo = $4 WHERE id = $1 RETURNING ${CAMPOS}`,
    [id, nombre.trim(), rol, activo],
  );
  return rows[0] || null;
}

async function cambiarPassword(id, password) {
  const hash = await bcrypt.hash(password, RONDAS_BCRYPT);
  await query('UPDATE usuarios SET password_hash = $2 WHERE id = $1', [id, hash]);
}

module.exports = {
  ROLES,
  LONGITUD_MINIMA_PASSWORD,
  contar,
  listar,
  listarActivos,
  buscarPorId,
  verificarCredenciales,
  crear,
  actualizar,
  cambiarPassword,
};
