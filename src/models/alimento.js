const { query, transaccion } = require('../config/db');
const { Filtro } = require('../utils/filtros');
const { hoy } = require('../utils/helpers');

const TIPOS = {
  carne: 'Carne',
  pescado: 'Pescado',
  fruta: 'Fruta',
  verdura: 'Verdura',
  grano: 'Grano / semilla',
  concentrado: 'Concentrado',
  otro: 'Otro',
};
const UNIDADES = { kg: 'kg', lb: 'lb', litro: 'litros', unidad: 'unidades' };
const ESTADOS_STOCK = { agotado: 'Agotado', bajo: 'Stock bajo', ok: 'Suficiente' };

// Consumo diario = suma de las raciones programadas para animales activos.
const SELECT_BASE = `
  SELECT ia.*,
         CASE WHEN ia.stock = 0 THEN 'agotado'
              WHEN ia.stock <= ia.stock_minimo THEN 'bajo'
              ELSE 'ok' END AS estado_stock,
         (SELECT COALESCE(SUM(d.cantidad), 0)
            FROM dietas d JOIN animales an ON an.id = d.animal_id
           WHERE d.alimento_id = ia.id AND an.activo) AS consumo_diario
    FROM inventario_alimentos ia`;

const CONDICION_BAJO = 'ia.stock <= ia.stock_minimo';

async function listar({ texto, tipo, soloBajos } = {}) {
  const f = new Filtro()
    .agregarTexto('ia.nombre ILIKE ?', texto)
    .agregar('ia.tipo = ?', tipo);
  if (soloBajos) f.condiciones.push(CONDICION_BAJO);
  const { rows } = await query(`${SELECT_BASE} ${f.sql} ORDER BY ia.nombre`, f.parametros);
  return rows;
}

async function buscarPorId(id) {
  const { rows } = await query(`${SELECT_BASE} WHERE ia.id = $1`, [id]);
  return rows[0] || null;
}

async function contarBajos() {
  const { rows } = await query(`SELECT COUNT(*)::int AS total FROM inventario_alimentos ia WHERE ${CONDICION_BAJO}`);
  return rows[0].total;
}

// El stock solo cambia mediante movimientos; el inicial queda registrado como una entrada.
async function crear({ nombre, tipo, unidad, stockMinimo, stockInicial, usuarioId }) {
  return transaccion(async (client) => {
    const { rows } = await client.query(
      `INSERT INTO inventario_alimentos (nombre, tipo, unidad, stock, stock_minimo)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [nombre, tipo, unidad, stockInicial || 0, stockMinimo || 0],
    );
    if (stockInicial > 0) {
      await client.query(
        `INSERT INTO movimientos_inventario (alimento_id, tipo, cantidad, fecha, usuario_id, observaciones)
         VALUES ($1, 'entrada', $2, $3, $4, 'Stock inicial')`,
        [rows[0].id, stockInicial, hoy(), usuarioId],
      );
    }
    return rows[0];
  });
}

async function actualizar(id, { nombre, tipo, unidad, stockMinimo }) {
  const { rowCount } = await query(
    'UPDATE inventario_alimentos SET nombre = $2, tipo = $3, unidad = $4, stock_minimo = $5 WHERE id = $1',
    [id, nombre, tipo, unidad, stockMinimo || 0],
  );
  return rowCount > 0;
}

async function eliminar(id) {
  const { rowCount } = await query('DELETE FROM inventario_alimentos WHERE id = $1', [id]);
  return rowCount > 0;
}

module.exports = {
  TIPOS, UNIDADES, ESTADOS_STOCK, listar, buscarPorId, contarBajos, crear, actualizar, eliminar,
};
