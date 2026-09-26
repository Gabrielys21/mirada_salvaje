const Movimiento = require('../models/movimientoInventario');
const Alimento = require('../models/alimento');
const { erroresDe, ErrorNegocio } = require('../utils/validacion');
const {
  hoy, esFechaValida, parsearId, parsearDecimal, cantidad,
} = require('../utils/helpers');

const RUTA = '/alimentacion/movimientos';

function leerFiltros(q) {
  const filtros = {
    desde: esFechaValida(q.desde) ? q.desde : undefined,
    hasta: esFechaValida(q.hasta) ? q.hasta : undefined,
    alimentoId: parsearId(q.alimento_id) || undefined,
    tipo: Object.hasOwn(Movimiento.TIPOS, q.tipo) ? q.tipo : undefined,
  };
  if (filtros.desde && filtros.hasta && filtros.desde > filtros.hasta) {
    [filtros.desde, filtros.hasta] = [filtros.hasta, filtros.desde];
  }
  return filtros;
}

function leerCuerpo(body) {
  return {
    alimentoId: parsearId(body.alimento_id),
    tipo: body.tipo,
    cantidad: parsearDecimal(body.cantidad),
    fecha: body.fecha,
    observaciones: String(body.observaciones || '').trim(),
  };
}

async function renderForm(res, { movimiento, errores = [] }, status = 200) {
  const alimentos = await Alimento.listar();
  res.status(status).render('alimentacion/movimiento-form', {
    title: 'Registrar movimiento de inventario',
    movimiento,
    errores,
    alimentos,
    tipos: Movimiento.TIPOS,
    unidades: Alimento.UNIDADES,
  });
}

async function index(req, res) {
  const filtros = leerFiltros(req.query);
  const [movimientos, alimentos] = await Promise.all([Movimiento.listar(filtros), Alimento.listar()]);
  res.render('alimentacion/movimientos', {
    title: 'Movimientos de inventario',
    movimientos,
    alimentos,
    filtros,
    tipos: Movimiento.TIPOS,
    unidades: Alimento.UNIDADES,
  });
}

async function nuevo(req, res) {
  await renderForm(res, {
    movimiento: {
      alimento_id: parsearId(req.query.alimento_id),
      tipo: Object.hasOwn(Movimiento.TIPOS, req.query.tipo) ? req.query.tipo : 'salida',
      cantidad: '',
      fecha: hoy(),
      observaciones: '',
    },
  });
}

async function crear(req, res) {
  const datos = leerCuerpo(req.body);
  const errores = erroresDe(req);
  const formulario = {
    alimento_id: datos.alimentoId, tipo: datos.tipo, cantidad: datos.cantidad, fecha: datos.fecha, observaciones: datos.observaciones,
  };
  if (!errores.length) {
    try {
      const { stock } = await Movimiento.registrar({ ...datos, usuarioId: req.user.id });
      const alimento = await Alimento.buscarPorId(datos.alimentoId);
      req.flash(
        alimento.estado_stock === 'ok' ? 'exito' : 'aviso',
        `${Movimiento.TIPOS[datos.tipo]} registrada. Stock de "${alimento.nombre}": ${cantidad(stock)} ${alimento.unidad}`
          + `${alimento.estado_stock === 'ok' ? '.' : ` — ¡por debajo del mínimo (${cantidad(alimento.stock_minimo)})!`}`,
      );
      return res.redirect(`/alimentacion/inventario/${alimento.id}`);
    } catch (err) {
      if (!(err instanceof ErrorNegocio)) throw err;
      errores.push(err.message);
    }
  }
  return renderForm(res, { movimiento: formulario, errores }, 422);
}

async function eliminar(req, res) {
  const id = parsearId(req.params.id);
  const movimiento = id ? await Movimiento.buscarPorId(id) : null;
  if (!movimiento) {
    req.flash('error', 'El movimiento no existe.');
    return res.redirect(RUTA);
  }
  try {
    await Movimiento.eliminar(movimiento.id);
    req.flash('exito', `Movimiento anulado; el stock de "${movimiento.alimento_nombre}" fue ajustado.`);
  } catch (err) {
    if (!(err instanceof ErrorNegocio)) throw err;
    req.flash('error', err.message);
  }
  return res.redirect(RUTA);
}

module.exports = {
  index, nuevo, crear, eliminar,
};
