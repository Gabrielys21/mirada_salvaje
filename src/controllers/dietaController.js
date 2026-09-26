const Dieta = require('../models/dieta');
const Animal = require('../models/animal');
const Alimento = require('../models/alimento');
const { erroresDe } = require('../utils/validacion');
const { parsearId, parsearDecimal } = require('../utils/helpers');

const RUTA = '/alimentacion/dietas';

function leerCuerpo(body) {
  return {
    animalId: parsearId(body.animal_id),
    alimentoId: parsearId(body.alimento_id),
    cantidad: parsearDecimal(body.cantidad),
    horario: body.horario,
    observaciones: String(body.observaciones || '').trim(),
  };
}

function aFormulario(datos, id) {
  return {
    id,
    animal_id: datos.animalId,
    alimento_id: datos.alimentoId,
    cantidad: datos.cantidad,
    horario: datos.horario,
    observaciones: datos.observaciones,
  };
}

// Tras guardar se vuelve al listado filtrado por el animal.
function rutaDeAnimal(animalId) {
  return animalId ? `${RUTA}?animal_id=${animalId}` : RUTA;
}

async function validarReferencias(datos, actual) {
  const errores = [];
  if (datos.animalId) {
    const animal = await Animal.buscarPorId(datos.animalId);
    if (!animal || (!animal.activo && animal.id !== (actual && actual.animal_id))) {
      errores.push('El animal seleccionado no está disponible.');
    }
  }
  if (datos.alimentoId && !(await Alimento.buscarPorId(datos.alimentoId))) {
    errores.push('El alimento seleccionado no existe.');
  }
  return errores;
}

async function renderForm(res, { dieta, errores = [], actual }, status = 200) {
  const [animales, alimentos] = await Promise.all([Animal.listarActivos(), Alimento.listar()]);
  if (actual && !animales.some((a) => a.id === actual.animal_id)) {
    animales.push({ id: actual.animal_id, nombre: `${actual.animal_nombre} (inactivo)`, especie: actual.especie });
  }
  res.status(status).render('alimentacion/dieta-form', {
    title: dieta.id ? 'Editar dieta' : 'Nueva dieta',
    dieta,
    errores,
    animales,
    alimentos,
    unidades: Alimento.UNIDADES,
  });
}

async function cargarDieta(req, res) {
  const id = parsearId(req.params.id);
  const dieta = id ? await Dieta.buscarPorId(id) : null;
  if (!dieta) {
    req.flash('error', 'La dieta no existe.');
    res.redirect(RUTA);
  }
  return dieta;
}

async function index(req, res) {
  const filtros = {
    animalId: parsearId(req.query.animal_id) || undefined,
    alimentoId: parsearId(req.query.alimento_id) || undefined,
  };
  const [dietas, animales, alimentos] = await Promise.all([
    Dieta.listar(filtros), Animal.listar(), Alimento.listar(),
  ]);
  res.render('alimentacion/dietas', {
    title: 'Dietas', dietas, animales, alimentos, filtros, unidades: Alimento.UNIDADES,
  });
}

async function nueva(req, res) {
  await renderForm(res, {
    dieta: { animal_id: parsearId(req.query.animal_id), cantidad: '', horario: '', observaciones: '' },
  });
}

async function crear(req, res) {
  const datos = leerCuerpo(req.body);
  const errores = [...erroresDe(req), ...(await validarReferencias(datos))];
  if (errores.length) return renderForm(res, { dieta: aFormulario(datos), errores }, 422);
  await Dieta.crear(datos);
  req.flash('exito', 'Dieta registrada.');
  return res.redirect(rutaDeAnimal(datos.animalId));
}

async function editar(req, res) {
  const dieta = await cargarDieta(req, res);
  if (!dieta) return;
  await renderForm(res, { dieta, actual: dieta });
}

async function actualizar(req, res) {
  const actual = await cargarDieta(req, res);
  if (!actual) return;
  const datos = leerCuerpo(req.body);
  const errores = [...erroresDe(req), ...(await validarReferencias(datos, actual))];
  if (errores.length) {
    await renderForm(res, { dieta: aFormulario(datos, actual.id), errores, actual }, 422);
    return;
  }
  await Dieta.actualizar(actual.id, datos);
  req.flash('exito', 'Dieta actualizada.');
  res.redirect(rutaDeAnimal(datos.animalId));
}

async function eliminar(req, res) {
  const dieta = await cargarDieta(req, res);
  if (!dieta) return;
  await Dieta.eliminar(dieta.id);
  req.flash('exito', `Dieta de "${dieta.animal_nombre}" eliminada.`);
  res.redirect(rutaDeAnimal(dieta.animal_id));
}

module.exports = {
  index, nueva, crear, editar, actualizar, eliminar,
};
