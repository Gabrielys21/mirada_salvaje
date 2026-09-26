const Movimiento = require('../models/movimientoInventario');
const Alimento = require('../models/alimento');
const { enviarCsv } = require('../utils/csv');
const {
  hoy, primerDiaDelMes, esFechaValida, fecha,
} = require('../utils/helpers');

// Días que alcanza el stock con el consumo diario programado en las dietas.
function diasCobertura(fila) {
  return fila.consumo_diario > 0 ? Math.floor(fila.stock / fila.consumo_diario) : null;
}

async function reporte(req, res) {
  const filtros = {
    desde: esFechaValida(req.query.desde) ? req.query.desde : primerDiaDelMes(),
    hasta: esFechaValida(req.query.hasta) ? req.query.hasta : hoy(),
    tipoAlimento: Object.hasOwn(Alimento.TIPOS, req.query.tipo) ? req.query.tipo : undefined,
  };
  if (filtros.desde > filtros.hasta) [filtros.desde, filtros.hasta] = [filtros.hasta, filtros.desde];

  const filas = (await Movimiento.resumenPorAlimento(filtros)).map((f) => ({ ...f, dias_cobertura: diasCobertura(f) }));

  if (req.query.formato === 'csv') {
    return enviarCsv(
      res,
      `reporte-alimentacion_${filtros.desde}_${filtros.hasta}.csv`,
      ['Alimento', 'Tipo', 'Unidad', `Entradas ${fecha(filtros.desde)}-${fecha(filtros.hasta)}`, 'Salidas', 'Stock actual',
        'Stock mínimo', 'Estado', 'Consumo diario programado', 'Días de cobertura'],
      filas.map((f) => [
        f.nombre, Alimento.TIPOS[f.tipo], f.unidad, f.entradas, f.salidas, f.stock, f.stock_minimo,
        Alimento.ESTADOS_STOCK[f.estado_stock], f.consumo_diario, f.dias_cobertura ?? '',
      ]),
    );
  }

  return res.render('alimentacion/reporte', {
    title: 'Reporte de alimentación',
    filtros,
    filas,
    alertas: filas.filter((f) => f.estado_stock !== 'ok'),
    tipos: Alimento.TIPOS,
    unidades: Alimento.UNIDADES,
    estadosStock: Alimento.ESTADOS_STOCK,
  });
}

module.exports = { reporte };
