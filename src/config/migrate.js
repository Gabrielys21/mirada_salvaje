const fs = require('fs/promises');
const path = require('path');
const { pool } = require('./db');

const DIRECTORIO = path.join(__dirname, '..', 'migrations');
const CANDADO = 727274; // Evita que dos instancias migren a la vez.

async function runMigrations() {
  const client = await pool.connect();
  try {
    await client.query('SELECT pg_advisory_lock($1)', [CANDADO]);
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      nombre VARCHAR(255) PRIMARY KEY,
      aplicada_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    const { rows } = await client.query('SELECT nombre FROM schema_migrations');
    const aplicadas = new Set(rows.map((r) => r.nombre));
    const archivos = (await fs.readdir(DIRECTORIO)).filter((f) => f.endsWith('.sql')).sort();

    for (const archivo of archivos) {
      if (aplicadas.has(archivo)) continue;
      const sql = await fs.readFile(path.join(DIRECTORIO, archivo), 'utf8');
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (nombre) VALUES ($1)', [archivo]);
        await client.query('COMMIT');
        console.log(`Migración aplicada: ${archivo}`);
      } catch (err) {
        await client.query('ROLLBACK');
        throw new Error(`Falló la migración ${archivo}: ${err.message}`);
      }
    }
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [CANDADO]).catch(() => {});
    client.release();
  }
}

if (require.main === module) {
  runMigrations()
    .then(() => console.log('Migraciones al día.'))
    .catch((err) => {
      console.error(err.message);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}

module.exports = { runMigrations };
