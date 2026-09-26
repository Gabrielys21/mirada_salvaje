const VentaEntrada = require('../models/ventaEntrada');
const TipoEntrada = require('../models/tipoEntrada');
const Promocion = require('../models/promocion');
const { erroresDe, ErrorNegocio } = require('../utils/validacion');
const { enviarCsv } = require('../utils/csv');
const {
  hoy, primerDiaDelMes, esFechaValida, parsearId, fechaHora,
} = require('../utils/helpers');

const RUTA = '/entradas/ventas';

function leerFiltros(q, porDefecto = {}) {
  const filtros = {
    desde: esFechaValida(q.desde) ? q.desde : porDefecto.desde,
    hasta: esFechaValida(q.hasta) ? q.hasta : porDefecto.hasta,
    tipoEntradaId: parsearId(q.tipo_entrada_id) || undefined,
  };
  if (filtros.desde && filtros.hasta && filtros.desde > filtros.hasta) {
    [filtros.desde, filtros.hasta] = [filtros.hasta, filtros.desde];
  }
  return filtros;
}

async function renderForm(res, { venta, errores = [] }, status = 200) {
  const precios = await TipoEntrada.listarConPrecioDelDia(hoy());
  res.status(status).render('entradas/venta-form', {
    title: 'Vender entradas', venta, errores, precios,
  });
}

async function index(req, res) {
  const filtros = leerFiltros(req.query, { desde: hoy(), hasta: hoy() });
  const [ventas, tipos, { totales }] = await Promise.all([
    VentaEntrada.listar(filtros), TipoEntrada.listar(), VentaEntrada.resumen(filtros),
  ]);
  res.render('entradas/ventas', {
    title: 'Ventas de entradas', ventas, tipos, filtros, totales,
  });
}

async function nueva(req, res) {
  await renderForm(res, { venta: { tipo_entrada_id: parsearId(req.query.tipo_entrada_id), cantidad: 1 } });
}

async function crear(req, res) {
  const datos = { tipoEntradaId: parsearId(req.body.tipo_entrada_id), cantidad: Number(req.body.cantidad) };
  const errores = erroresDe(req);
  if (!errores.length) {
    try {
      const { id } = await VentaEntrada.registrar({ ...datos, vendedorId: req.user.id, hoy: hoy() });
      return res.redirect(`${RUTA}/${id}`);
    } catch (err) {
      if (!(err instanceof ErrorNegocio)) throw err;
      errores.push(err.message);
    }
  }
  return renderForm(res, { venta: { tipo_entrada_id: datos.tipoEntradaId, cantidad: req.body.cantidad }, errores }, 422);
}

// Comprobante imprimible de una venta.
async function detalle(req, res) {
  const id = parsearId(req.params.id);
  const venta = id ? await VentaEntrada.buscarPorId(id) : null;
  if (!venta) {
    req.flash('error', 'La venta no existe.');
    return res.redirect(RUTA);
  }
  return res.render('entradas/venta', { title: `Venta #${venta.id}`, venta });
}

async function eliminar(req, res) {
  const id = parsearId(req.params.id);
  if (id && await VentaEntrada.eliminar(id)) {
    req.flash('exito', `Venta #${id} anulada.`);
  } else {
    req.flash('error', 'La venta no existe.');
  }
  res.redirect(RUTA);
}

async function reporte(req, res) {
  const filtros = leerFiltros(req.query, { desde: primerDiaDelMes(), hasta: hoy() });

  if (req.query.formato === 'csv') {
    const ventas = await VentaEntrada.listar(filtros, { limite: 20000 });
    return enviarCsv(
      res,
      `reporte-ventas_${filtros.desde}_${filtros.hasta}.csv`,
      ['No. venta', 'Fecha y hora', 'Tipo de entrada', 'Cantidad', 'Precio unitario', 'Promoción', '% descuento', 'Descuento', 'Total', 'Vendedor'],
      ventas.map((v) => [
        v.id, fechaHora(v.fecha), v.tipo_entrada_nombre, v.cantidad, v.precio_unitario.toFixed(2), v.promocion_nombre || '',
        v.porcentaje_descuento, v.descuento.toFixed(2), v.total.toFixed(2), v.vendedor_nombre,
      ]),
    );
  }

  const [resumen, tipos, promocionesVigentes] = await Promise.all([
    VentaEntrada.resumen(filtros), TipoEntrada.listar(), Promocion.contarVigentes(hoy()),
  ]);
  return res.render('entradas/reporte', {
    title: 'Reporte de ventas', filtros, tipos, promocionesVigentes, ...resumen,
  });
}

module.exports = {
  index, nueva, crear, detalle, eliminar, reporte,
};
