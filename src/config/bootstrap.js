const Usuario = require('../models/usuario');

// Crea el primer administrador a partir de variables de entorno si todavía no hay usuarios.
async function ensureAdmin() {
  if ((await Usuario.contar()) > 0) return;

  const { ADMIN_USERNAME, ADMIN_PASSWORD, ADMIN_NOMBRE } = process.env;
  if (!ADMIN_USERNAME || !ADMIN_PASSWORD) {
    console.warn('No hay usuarios registrados. Define ADMIN_USERNAME y ADMIN_PASSWORD para crear el administrador inicial.');
    return;
  }
  if (ADMIN_PASSWORD.length < Usuario.LONGITUD_MINIMA_PASSWORD) {
    console.warn(`ADMIN_PASSWORD debe tener al menos ${Usuario.LONGITUD_MINIMA_PASSWORD} caracteres; no se creó el administrador.`);
    return;
  }

  await Usuario.crear({
    nombre: ADMIN_NOMBRE || 'Administrador',
    username: ADMIN_USERNAME,
    password: ADMIN_PASSWORD,
    rol: 'admin',
  });
  console.log(`Administrador inicial "${ADMIN_USERNAME}" creado.`);
}

module.exports = { ensureAdmin };
