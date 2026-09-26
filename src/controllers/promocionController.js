const Promocion = require('../models/promocion');
const TipoEntrada = require('../models/tipoEntrada');
const { erroresDe } = require('../utils/validacion');
const { hoy, parsearId, parsearDecimal } = require('../utils/helpers');

const RUTA = '/entradas/promociones';

function leerCuerpo(body) {
  return {
    nombre: String(body.nombre || '').trim(),
    descripcion: String(body.descripcion || '').trim(),
    porcentajeDescuento: parsearDecimal(body.porcentaje_descuento),
    fechaInicio: body.fecha_inicio,
    fechaFin: body.fecha_fin,
    tipoEntradaId: parsearId(body.tipo_entrada_id),
    activo: body.activo === 'on',
  };
}

function aFormulario(body, id) {
  return {
    id,
    nombre: body.nombre,
    descripcion: body.descripcion,
    porcentaje_descuento: body.porcentaje_descuento,
    fecha_inicio: body.fecha_inicio,
    fecha_fin: body.fecha_fin,
    tipo_entrada_id: parsearId(body.tipo_entrada_id),
    activo: body.activo === 'on',
  };
}

async function validarTipo(datos) {
  if (datos.tipoEntradaId && !(await TipoEntrada.buscarPorId(datos.tipoEntradaId))) {
    return ['El tipo de entrada seleccionado no existe.'];
  }
  return [];
}

async function renderForm(res, { promocion, errores = [] }, status = 200) {
  const tipos = await TipoEntrada.listar();
  res.status(status).render('entradas/promocion-form', {
    title: promocion.id ? 'Editar promoción' : 'Nueva promoción',
    promocion,
    errores,
    tipos,
  });
}

async function cargarPromocion(req, res) {
  const id = parsearId(req.params.id);
  const promocion = id ? await Promocion.buscarPorId(id, hoy()) : null;
  if (!promocion) {
    req.flash('error', 'La promoción no existe.');
    res.redirect(RUTA);
  }
  return promocion;
}

async function index(req, res) {
  const estado = Object.hasOwn(Promocion.ESTADOS, req.query.estado) ? req.query.estado : '';
  const promociones = await Promocion.listar({ hoy: hoy(), estado });
  res.render('entradas/promociones', {
    title: 'Promociones', promociones, estado, estados: Promocion.ESTADOS,
  });
}

async function nueva(req, res) {
  await renderForm(res, {
    promocion: {
      nombre: '', descripcion: '', porcentaje_descuento: '', fecha_inicio: hoy(), fecha_fin: '', tipo_entrada_id: null, activo: true,
    },
  });
}

async function crear(req, res) {
  const datos = leerCuerpo(req.body);
  const errores = [...erroresDe(req), ...(await validarTipo(datos))];
  if (errores.length) return renderForm(res, { promocion: { ...aFormulario(req.body), activo: true }, errores }, 422);
  await Promocion.crear(datos);
  req.flash('exito', `Promoción "${datos.nombre}" creada.`);
  return res.redirect(RUTA);
}

async function editar(req, res) {
  const promocion = await cargarPromocion(req, res);
  if (!promocion) return;
  await renderForm(res, { promocion });
}

async function actualizar(req, res) {
  const promocion = await cargarPromocion(req, res);
  if (!promocion) return;
  const datos = leerCuerpo(req.body);
  const errores = [...erroresDe(req), ...(await validarTipo(datos))];
  if (errores.length) {
    await renderForm(res, { promocion: aFormulario(req.body, promocion.id), errores }, 422);
    return;
  }
  await Promocion.actualizar(promocion.id, datos);
  req.flash('exito', `Promoción "${datos.nombre}" actualizada.`);
  res.redirect(RUTA);
}

async function eliminar(req, res) {
  const promocion = await cargarPromocion(req, res);
  if (!promocion) return;
  if (await Promocion.eliminar(promocion.id)) {
    req.flash('exito', `Promoción "${promocion.nombre}" eliminada.`);
  } else {
    req.flash('error', `"${promocion.nombre}" ya se aplicó en ventas. Desactívala en lugar de eliminarla.`);
  }
  res.redirect(RUTA);
}

module.exports = {
  index, nueva, crear, editar, actualizar, eliminar,
};
