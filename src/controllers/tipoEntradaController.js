const TipoEntrada = require('../models/tipoEntrada');
const { erroresDe, mensajeErrorBd, esErrorDeReferencia } = require('../utils/validacion');
const { parsearId, parsearDecimal } = require('../utils/helpers');

const RUTA = '/entradas/tipos';

function leerCuerpo(body) {
  return {
    nombre: String(body.nombre || '').trim(),
    precio: parsearDecimal(body.precio),
    descripcion: String(body.descripcion || '').trim(),
    activo: body.activo === 'on',
  };
}

function renderForm(res, { tipo, errores = [] }, status = 200) {
  res.status(status).render('entradas/tipo-form', {
    title: tipo.id ? 'Editar tipo de entrada' : 'Nuevo tipo de entrada',
    tipo,
    errores,
  });
}

async function cargarTipo(req, res) {
  const id = parsearId(req.params.id);
  const tipo = id ? await TipoEntrada.buscarPorId(id) : null;
  if (!tipo) {
    req.flash('error', 'El tipo de entrada no existe.');
    res.redirect(RUTA);
  }
  return tipo;
}

async function index(req, res) {
  const tipos = await TipoEntrada.listar();
  res.render('entradas/tipos', { title: 'Tipos de entrada', tipos });
}

function nuevo(req, res) {
  renderForm(res, { tipo: { nombre: '', precio: '', descripcion: '', activo: true } });
}

async function crear(req, res) {
  const datos = leerCuerpo(req.body);
  const errores = erroresDe(req);
  if (!errores.length) {
    try {
      await TipoEntrada.crear(datos);
      req.flash('exito', `Tipo de entrada "${datos.nombre}" creado.`);
      return res.redirect(RUTA);
    } catch (err) {
      const mensaje = mensajeErrorBd(err, { duplicado: 'Ya existe un tipo de entrada con ese nombre.' });
      if (!mensaje) throw err;
      errores.push(mensaje);
    }
  }
  return renderForm(res, { tipo: { ...datos, precio: req.body.precio, activo: true }, errores }, 422);
}

async function editar(req, res) {
  const tipo = await cargarTipo(req, res);
  if (!tipo) return;
  renderForm(res, { tipo });
}

async function actualizar(req, res) {
  const tipo = await cargarTipo(req, res);
  if (!tipo) return;
  const datos = leerCuerpo(req.body);
  const errores = erroresDe(req);
  if (!errores.length) {
    try {
      await TipoEntrada.actualizar(tipo.id, datos);
      req.flash('exito', `Tipo de entrada "${datos.nombre}" actualizado.`);
      res.redirect(RUTA);
      return;
    } catch (err) {
      const mensaje = mensajeErrorBd(err, { duplicado: 'Ya existe un tipo de entrada con ese nombre.' });
      if (!mensaje) throw err;
      errores.push(mensaje);
    }
  }
  renderForm(res, { tipo: { ...datos, precio: req.body.precio, id: tipo.id }, errores }, 422);
}

async function eliminar(req, res) {
  const tipo = await cargarTipo(req, res);
  if (!tipo) return;
  try {
    await TipoEntrada.eliminar(tipo.id);
    req.flash('exito', `Tipo de entrada "${tipo.nombre}" eliminado.`);
  } catch (err) {
    if (!esErrorDeReferencia(err)) throw err;
    req.flash('error', `"${tipo.nombre}" tiene ventas registradas. Desactívalo en lugar de eliminarlo.`);
  }
  res.redirect(RUTA);
}

module.exports = {
  index, nuevo, crear, editar, actualizar, eliminar,
};
