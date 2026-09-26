const Animal = require('../models/animal');
const Area = require('../models/area');
const Dieta = require('../models/dieta');
const RegistroClinico = require('../models/registroClinico');
const { erroresDe, esErrorDeReferencia } = require('../utils/validacion');
const { parsearId, hoy } = require('../utils/helpers');

const RUTA = '/alimentacion/animales';
const FILTROS_ESTADO = { activos: true, inactivos: false, todos: undefined };

function leerCuerpo(body) {
  return {
    nombre: String(body.nombre || '').trim(),
    especie: String(body.especie || '').trim(),
    sexo: Object.hasOwn(Animal.SEXOS, body.sexo) ? body.sexo : null,
    fechaNacimiento: body.fecha_nacimiento || null,
    areaId: parsearId(body.area_id),
    observaciones: String(body.observaciones || '').trim(),
    activo: body.activo === 'on',
  };
}

function aFormulario(datos, id) {
  return {
    id,
    nombre: datos.nombre,
    especie: datos.especie,
    sexo: datos.sexo,
    fecha_nacimiento: datos.fechaNacimiento,
    area_id: datos.areaId,
    observaciones: datos.observaciones,
    activo: datos.activo,
  };
}

async function renderForm(res, { animal, errores = [] }, status = 200) {
  const areas = await Area.listar({ soloActivas: true });
  if (animal.area_id && !areas.some((a) => a.id === animal.area_id)) {
    const actual = await Area.buscarPorId(animal.area_id);
    if (actual) areas.push({ ...actual, nombre: `${actual.nombre} (inactiva)` });
  }
  res.status(status).render('alimentacion/animal-form', {
    title: animal.id ? 'Editar animal' : 'Nuevo animal',
    animal,
    errores,
    areas,
    sexos: Animal.SEXOS,
    tiposArea: Area.TIPOS,
  });
}

async function cargarAnimal(req, res) {
  const id = parsearId(req.params.id);
  const animal = id ? await Animal.buscarPorId(id) : null;
  if (!animal) {
    req.flash('error', 'El animal no existe.');
    res.redirect(RUTA);
  }
  return animal;
}

async function index(req, res) {
  const estado = Object.hasOwn(FILTROS_ESTADO, req.query.estado) ? req.query.estado : 'activos';
  const filtros = {
    texto: typeof req.query.texto === 'string' ? req.query.texto.trim().slice(0, 100) : '',
    areaId: parsearId(req.query.area_id) || undefined,
    estado,
  };
  const [animales, areas] = await Promise.all([
    Animal.listar({ texto: filtros.texto, areaId: filtros.areaId, activo: FILTROS_ESTADO[estado] }),
    Area.listar(),
  ]);
  res.render('alimentacion/animales', {
    title: 'Animales', animales, areas, filtros, sexos: Animal.SEXOS,
  });
}

async function detalle(req, res) {
  const animal = await cargarAnimal(req, res);
  if (!animal) return;
  const [dietas, historial, pendientes] = await Promise.all([
    Dieta.listar({ animalId: animal.id }),
    RegistroClinico.listar({ animalId: animal.id }, { limite: 20 }),
    RegistroClinico.pendientes({ hoy: hoy(), animalId: animal.id }),
  ]);
  res.render('alimentacion/animal', {
    title: animal.nombre, animal, dietas, historial, pendientes, sexos: Animal.SEXOS, tiposClinicos: RegistroClinico.TIPOS,
  });
}

async function nuevo(req, res) {
  await renderForm(res, { animal: { nombre: '', especie: '', activo: true } });
}

async function crear(req, res) {
  const datos = leerCuerpo(req.body);
  const errores = erroresDe(req);
  if (errores.length) return renderForm(res, { animal: aFormulario(datos), errores }, 422);
  const { id } = await Animal.crear(datos);
  req.flash('exito', `Animal "${datos.nombre}" registrado.`);
  return res.redirect(`${RUTA}/${id}`);
}

async function editar(req, res) {
  const animal = await cargarAnimal(req, res);
  if (!animal) return;
  await renderForm(res, { animal });
}

async function actualizar(req, res) {
  const animal = await cargarAnimal(req, res);
  if (!animal) return;
  const datos = leerCuerpo(req.body);
  const errores = erroresDe(req);
  if (errores.length) {
    await renderForm(res, { animal: aFormulario(datos, animal.id), errores }, 422);
    return;
  }
  await Animal.actualizar(animal.id, datos);
  req.flash('exito', `Animal "${datos.nombre}" actualizado.`);
  res.redirect(`${RUTA}/${animal.id}`);
}

async function eliminar(req, res) {
  const animal = await cargarAnimal(req, res);
  if (!animal) return;
  try {
    await Animal.eliminar(animal.id);
    req.flash('exito', `Animal "${animal.nombre}" eliminado junto con sus dietas.`);
  } catch (err) {
    if (!esErrorDeReferencia(err)) throw err;
    req.flash('error', `"${animal.nombre}" tiene historial clínico. Márcalo como inactivo en lugar de eliminarlo.`);
  }
  res.redirect(RUTA);
}

module.exports = {
  index, detalle, nuevo, crear, editar, actualizar, eliminar,
};
