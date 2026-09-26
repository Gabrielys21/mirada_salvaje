const { query, transaccion } = require('../config/db');
const { Filtro } = require('../utils/filtros');
const { ErrorNegocio } = require('../utils/validacion');
const { cantidad: formatoCantidad } = require('../utils/helpers');

const TIPOS = { entrada: 'Entrada', salida: 'Salida' };

const SELECT_BASE = `
  SELECT m.id, m.tipo, m.cantidad, m.fecha, m.observaciones, m.created_at,
         m.alimento_id, ia.nombre AS alimento_nombre, ia.unidad,
         m.usuario_id, u.nombre AS usuario_nombre
    FROM movimientos_inventario m
    JOIN inventario_alimentos ia ON ia.id = m.alimento_id
    JOIN usuarios u ON u.id = m.usuario_id`;

function construirFiltro({ desde, hasta, alimentoId, tipo } = {}) {
  return new Filtro()
    .agregar('m.fecha >= ?', desde)
    .agregar('m.fecha <= ?', hasta)
    .agregar('m.alimento_id = ?', alimentoId)
    .agregar('m.tipo = ?', tipo);
}

async function listar(filtros = {}, { limite = 500 } = {}) {
  const f = construirFiltro(filtros);
  f.parametros.push(limite);
  const { rows } = await query(
    `${SELECT_BASE} ${f.sql} ORDER BY m.fecha DESC, m.id DESC LIMIT $${f.parametros.length}`,
    f.parametros,
  );
  return rows;
}

async function buscarPorId(id) {
  const { rows } = await query(`${SELECT_BASE} WHERE m.id = $1`, [id]);
  return rows[0] || null;
}

// Suma (o resta) al stock sin dejarlo negativo; la condición en el WHERE evita carreras entre usuarios.
async function ajustarStock(client, alimentoId, delta) {
  const { rows } = await client.query(
    `UPDATE inventario_alimentos SET stock = stock + $2
      WHERE id = $1 AND stock + $2 >= 0
      RETURNING stock`,
    [alimentoId, delta],
  );
  if (rows.length) return rows[0].stock;

  const { rows: actual } = await client.query('SELECT nombre, stock, unidad FROM inventario_alimentos WHERE id = $1', [alimentoId]);
  if (!actual.length) throw new ErrorNegocio('El alimento seleccionado no existe.');
  const { nombre, stock, unidad } = actual[0];
  throw new ErrorNegocio(`Stock insuficiente de "${nombre}": hay ${formatoCantidad(stock)} ${unidad}.`);
}

async function registrar({ alimentoId, tipo, cantidad, fecha, usuarioId, observaciones }) {
  return transaccion(async (client) => {
    const stock = await ajustarStock(client, alimentoId, tipo === 'entrada' ? cantidad : -cantidad);
    const { rows } = await client.query(
      `INSERT INTO movimientos_inventario (alimento_id, tipo, cantidad, fecha, usuario_id, observaciones)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [alimentoId, tipo, cantidad, fecha, usuarioId, observaciones || null],
    );
    return { id: rows[0].id, stock };
  });
}

// Anula un movimiento revirtiendo su efecto en el stock.
async function eliminar(id) {
  return transaccion(async (client) => {
    const { rows } = await client.query('SELECT * FROM movimientos_inventario WHERE id = $1 FOR UPDATE', [id]);
    const mov = rows[0];
    if (!mov) return false;
    try {
      await ajustarStock(client, mov.alimento_id, mov.tipo === 'entrada' ? -mov.cantidad : mov.cantidad);
    } catch (err) {
      if (err instanceof ErrorNegocio) {
        throw new ErrorNegocio('No se puede anular esta entrada: el stock ya se consumió. Registra una salida de ajuste en su lugar.');
      }
      throw err;
    }
    await client.query('DELETE FROM movimientos_inventario WHERE id = $1', [id]);
    return true;
  });
}

// Una fila por alimento con entradas y salidas del periodo, stock actual y días de cobertura.
async function resumenPorAlimento({ desde, hasta, tipoAlimento } = {}) {
  const parametros = [desde, hasta];
  let filtroTipo = '';
  if (tipoAlimento) {
    parametros.push(tipoAlimento);
    filtroTipo = 'WHERE ia.tipo = $3';
  }
  const { rows } = await query(
    `SELECT ia.id, ia.nombre, ia.tipo, ia.unidad, ia.stock, ia.stock_minimo,
            CASE WHEN ia.stock = 0 THEN 'agotado'
                 WHEN ia.stock <= ia.stock_minimo THEN 'bajo'
                 ELSE 'ok' END AS estado_stock,
            COALESCE(SUM(m.cantidad) FILTER (WHERE m.tipo = 'entrada'), 0) AS entradas,
            COALESCE(SUM(m.cantidad) FILTER (WHERE m.tipo = 'salida'), 0) AS salidas,
            (SELECT COALESCE(SUM(d.cantidad), 0)
               FROM dietas d JOIN animales an ON an.id = d.animal_id
              WHERE d.alimento_id = ia.id AND an.activo) AS consumo_diario
       FROM inventario_alimentos ia
       LEFT JOIN movimientos_inventario m
              ON m.alimento_id = ia.id AND m.fecha BETWEEN $1 AND $2
      ${filtroTipo}
      GROUP BY ia.id
      ORDER BY ia.nombre`,
    parametros,
  );
  return rows;
}

module.exports = {
  TIPOS, listar, buscarPorId, registrar, eliminar, resumenPorAlimento,
};
