const Area = require('../models/area');
const { erroresDe, mensajeErrorBd, esErrorDeReferencia } = require('../utils/validacion');
const { parsearId } = require('../utils/helpers');

const RUTA = '/limpieza/areas';

function leerCuerpo(body) {
  return {
    nombre: String(body.nombre || '').trim(),
    tipo: body.tipo,
    descripcion: String(body.descripcion || '').trim(),
    activo: body.activo === 'on',
  };
}

function renderForm(res, { area, errores = [] }, status = 200) {
  res.status(status).render('limpieza/area-form', {
    title: area.id ? 'Editar área' : 'Nueva área',
    area,
    errores,
    tipos: Area.TIPOS,
  });
}

async function cargarArea(req) {
  const id = parsearId(req.params.id);
  return id ? Area.buscarPorId(id) : null;
}

function noEncontrada(req, res) {
  req.flash('error', 'El área no existe.');
  return res.redirect(RUTA);
}

async function index(req, res) {
  const areas = await Area.listar();
  res.render('limpieza/areas', { title: 'Áreas', areas, tipos: Area.TIPOS });
}

function nueva(req, res) {
  renderForm(res, { area: { nombre: '', tipo: '', descripcion: '', activo: true } });
}

async function crear(req, res) {
  const datos = leerCuerpo(req.body);
  const errores = erroresDe(req);
  if (!errores.length) {
    try {
      await Area.crear(datos);
      req.flash('exito', `Área "${datos.nombre}" creada.`);
      return res.redirect(RUTA);
    } catch (err) {
      const mensaje = mensajeErrorBd(err, { duplicado: 'Ya existe un área con ese nombre.' });
      if (!mensaje) throw err;
      errores.push(mensaje);
    }
  }
  return renderForm(res, { area: { ...datos, activo: true }, errores }, 422);
}

async function editar(req, res) {
  const area = await cargarArea(req);
  if (!area) return noEncontrada(req, res);
  return renderForm(res, { area });
}

async function actualizar(req, res) {
  const area = await cargarArea(req);
  if (!area) return noEncontrada(req, res);
  const datos = leerCuerpo(req.body);
  const errores = erroresDe(req);
  if (!errores.length) {
    try {
      await Area.actualizar(area.id, datos);
      req.flash('exito', `Área "${datos.nombre}" actualizada.`);
      return res.redirect(RUTA);
    } catch (err) {
      const mensaje = mensajeErrorBd(err, { duplicado: 'Ya existe un área con ese nombre.' });
      if (!mensaje) throw err;
      errores.push(mensaje);
    }
  }
  return renderForm(res, { area: { ...datos, id: area.id }, errores }, 422);
}

async function eliminar(req, res) {
  const area = await cargarArea(req);
  if (!area) return noEncontrada(req, res);
  try {
    await Area.eliminar(area.id);
    req.flash('exito', `Área "${area.nombre}" eliminada.`);
  } catch (err) {
    if (!esErrorDeReferencia(err)) throw err;
    req.flash('error', `"${area.nombre}" tiene registros de limpieza asociados. Desactívala en lugar de eliminarla.`);
  }
  return res.redirect(RUTA);
}

module.exports = { index, nueva, crear, editar, actualizar, eliminar };
