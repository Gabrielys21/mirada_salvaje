const Alimento = require('../models/alimento');
const Dieta = require('../models/dieta');
const Movimiento = require('../models/movimientoInventario');
const { erroresDe, mensajeErrorBd, esErrorDeReferencia } = require('../utils/validacion');
const { parsearId, parsearDecimal } = require('../utils/helpers');

const RUTA = '/alimentacion/inventario';

function leerCuerpo(body) {
  return {
    nombre: String(body.nombre || '').trim(),
    tipo: body.tipo,
    unidad: body.unidad,
    stockMinimo: parsearDecimal(body.stock_minimo) || 0,
    stockInicial: parsearDecimal(body.stock_inicial) || 0,
  };
}

function aFormulario(datos, id) {
  return {
    id,
    nombre: datos.nombre,
    tipo: datos.tipo,
    unidad: datos.unidad,
    stock_minimo: datos.stockMinimo,
    stock_inicial: datos.stockInicial,
  };
}

function renderForm(res, { alimento, errores = [] }, status = 200) {
  res.status(status).render('alimentacion/alimento-form', {
    title: alimento.id ? 'Editar alimento' : 'Nuevo alimento',
    alimento,
    errores,
    tipos: Alimento.TIPOS,
    unidades: Alimento.UNIDADES,
  });
}

async function cargarAlimento(req, res) {
  const id = parsearId(req.params.id);
  const alimento = id ? await Alimento.buscarPorId(id) : null;
  if (!alimento) {
    req.flash('error', 'El alimento no existe.');
    res.redirect(RUTA);
  }
  return alimento;
}

async function index(req, res) {
  const filtros = {
    texto: typeof req.query.texto === 'string' ? req.query.texto.trim().slice(0, 100) : '',
    tipo: Object.hasOwn(Alimento.TIPOS, req.query.tipo) ? req.query.tipo : undefined,
    soloBajos: req.query.bajos === '1',
  };
  const [alimentos, totalBajos] = await Promise.all([Alimento.listar(filtros), Alimento.contarBajos()]);
  res.render('alimentacion/inventario', {
    title: 'Inventario de alimentos',
    alimentos,
    totalBajos,
    filtros,
    tipos: Alimento.TIPOS,
    unidades: Alimento.UNIDADES,
    estadosStock: Alimento.ESTADOS_STOCK,
  });
}

async function detalle(req, res) {
  const alimento = await cargarAlimento(req, res);
  if (!alimento) return;
  const [movimientos, dietas] = await Promise.all([
    Movimiento.listar({ alimentoId: alimento.id }, { limite: 50 }),
    Dieta.listar({ alimentoId: alimento.id }),
  ]);
  res.render('alimentacion/alimento', {
    title: alimento.nombre,
    alimento,
    movimientos,
    dietas,
    tipos: Alimento.TIPOS,
    unidades: Alimento.UNIDADES,
    estadosStock: Alimento.ESTADOS_STOCK,
    tiposMovimiento: Movimiento.TIPOS,
  });
}

function nuevo(req, res) {
  renderForm(res, { alimento: { nombre: '', stock_minimo: '', stock_inicial: '' } });
}

async function crear(req, res) {
  const datos = leerCuerpo(req.body);
  const errores = erroresDe(req);
  if (!errores.length) {
    try {
      const { id } = await Alimento.crear({ ...datos, usuarioId: req.user.id });
      req.flash('exito', `Alimento "${datos.nombre}" agregado al inventario.`);
      return res.redirect(`${RUTA}/${id}`);
    } catch (err) {
      const mensaje = mensajeErrorBd(err, { duplicado: 'Ya existe un alimento con ese nombre.' });
      if (!mensaje) throw err;
      errores.push(mensaje);
    }
  }
  return renderForm(res, { alimento: aFormulario(datos), errores }, 422);
}

async function editar(req, res) {
  const alimento = await cargarAlimento(req, res);
  if (!alimento) return;
  renderForm(res, { alimento });
}

async function actualizar(req, res) {
  const alimento = await cargarAlimento(req, res);
  if (!alimento) return;
  const datos = leerCuerpo(req.body);
  const errores = erroresDe(req);
  if (!errores.length) {
    try {
      await Alimento.actualizar(alimento.id, datos);
      req.flash('exito', `Alimento "${datos.nombre}" actualizado.`);
      res.redirect(`${RUTA}/${alimento.id}`);
      return;
    } catch (err) {
      const mensaje = mensajeErrorBd(err, { duplicado: 'Ya existe un alimento con ese nombre.' });
      if (!mensaje) throw err;
      errores.push(mensaje);
    }
  }
  renderForm(res, { alimento: { ...aFormulario(datos, alimento.id), stock: alimento.stock }, errores }, 422);
}

async function eliminar(req, res) {
  const alimento = await cargarAlimento(req, res);
  if (!alimento) return;
  try {
    await Alimento.eliminar(alimento.id);
    req.flash('exito', `Alimento "${alimento.nombre}" eliminado.`);
  } catch (err) {
    if (!esErrorDeReferencia(err)) throw err;
    req.flash('error', `"${alimento.nombre}" tiene movimientos o dietas registradas y no se puede eliminar.`);
  }
  res.redirect(RUTA);
}

module.exports = {
  index, detalle, nuevo, crear, editar, actualizar, eliminar,
};
