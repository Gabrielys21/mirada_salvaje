require('dotenv').config({ quiet: true });
const { Pool, types } = require('pg');

if (!process.env.DATABASE_URL) {
  throw new Error('Falta la variable de entorno DATABASE_URL. Revisa .env.example.');
}

// DATE se devuelve como 'YYYY-MM-DD' para evitar desfases de zona horaria.
types.setTypeParser(1082, (valor) => valor);
// NUMERIC se devuelve como número (cantidades y precios con 2 decimales).
types.setTypeParser(1700, (valor) => (valor === null ? null : parseFloat(valor)));

function configuracionSsl(url) {
  const bandera = (process.env.DATABASE_SSL || '').toLowerCase();
  if (bandera === 'false') return false;
  if (bandera === 'true') return { rejectUnauthorized: false };
  const host = new URL(url).hostname;
  return ['localhost', '127.0.0.1', '::1'].includes(host) ? false : { rejectUnauthorized: false };
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: configuracionSsl(process.env.DATABASE_URL),
  max: 5,
});

pool.on('error', (err) => {
  console.error('Error inesperado en el pool de PostgreSQL:', err.message);
});

function query(texto, parametros) {
  return pool.query(texto, parametros);
}

// Ejecuta fn(client) dentro de BEGIN/COMMIT; ante cualquier error hace ROLLBACK.
async function transaccion(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const resultado = await fn(client);
    await client.query('COMMIT');
    return resultado;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { pool, query, transaccion };
