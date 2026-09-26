const RegistroClinico = require('../models/registroClinico');
const Animal = require('../models/animal');
const { esAdmin } = require('../middlewares/auth');
const { erroresDe } = require('../utils/validacion');
const { enviarCsv } = require('../utils/csv');
const {
  hoy, sumarDias, esFechaValida, parsearId, fecha,
} = require('../utils/helpers');

const RUTA = '/clinico/registros';
const HORIZONTES = [7, 15, 30, 60, 90];

// ---------- Utilidades internas ----------

function leerFiltros(q) {
  const filtros = {
    desde: esFechaValida(q.desde) ? q.desde : undefined,
    hasta: esFechaValida(q.hasta) ? q.hasta : undefined,
    animalId: parsearId(q.animal_id) || undefined,
    tipo: Object.hasOwn(RegistroClinico.TIPOS, q.tipo) ? q.tipo : undefined,
    texto: typeof q.texto === 'string' ? q.texto.trim().slice(0, 100) : '',
  };
  if (filtros.desde && filtros.hasta && filtros.desde > filtros.hasta) {
    [filtros.desde, filtros.hasta] = [filtros.hasta, filtros.desde];
  }
  return filtros;
}

function puedeGestionar(req, registro) {
  return esAdmin(req) || registro.registrado_por === req.user.id;
}

function leerCuerpo(body) {
  return {
    animalId: parsearId(body.animal_id),
    tipo: body.tipo,
    producto: String(body.producto || '').trim(),
    dosis: String(body.dosis || '').trim(),
    fechaAplicacion: body.fecha_aplicacion,
    proximaFecha: body.proxima_fecha || null,
    observaciones: String(body.observaciones || '').trim(),
  };
}

function aFormulario(datos, id) {
  return {
    id,
    animal_id: datos.animalId,
    tipo: datos.tipo,
    producto: datos.producto,
    dosis: datos.dosis,
    fecha_aplicacion: datos.fechaAplicacion,
    proxima_fecha: datos.proximaFecha,
    observaciones: datos.observaciones,
  };
}

async function validarAnimal(datos, actual) {
  if (!datos.animalId) return [];
  const animal = await Animal.buscarPorId(datos.animalId);
  if (!animal || (!animal.activo && animal.id !== (actual && actual.animal_id))) {
    return ['El animal seleccionado no está disponible.'];
  }
  return [];
}

async function renderForm(res, { registro, errores = [], actual }, status = 200) {
  const animales = await Animal.listarActivos();
  if (actual && !animales.some((a) => a.id === actual.animal_id)) {
    animales.push({ id: actual.animal_id, nombre: `${actual.animal_nombre} (inactivo)`, especie: actual.especie });
  }
  res.status(status).render('clinico/registro-form', {
    title: registro.id ? 'Editar registro clínico' : 'Nuevo registro clínico',
    registro,
    errores,
    animales,
    tipos: RegistroClinico.TIPOS,
  });
}

async function cargarRegistro(req, res) {
  const id = parsearId(req.params.id);
  const registro = id ? await RegistroClinico.buscarPorId(id) : null;
  if (!registro) {
    req.flash('error', 'El registro clínico no existe.');
    res.redirect(RUTA);
    return null;
  }
  if (!puedeGestionar(req, registro)) {
    req.flash('error', 'Solo puedes modificar los registros clínicos que tú registraste.');
    res.redirect(RUTA);
    return null;
  }
  return registro;
}

// ---------- Acciones ----------

async function index(req, res) {
  const filtros = leerFiltros(req.query);
  const registros = await RegistroClinico.listar(filtros, { limite: req.query.formato === 'csv' ? 5000 : 500 });

  if (req.query.formato === 'csv') {
    return enviarCsv(
      res,
      `historial-clinico_${hoy()}.csv`,
      ['Fecha de aplicación', 'Animal', 'Especie', 'Tipo', 'Producto', 'Dosis', 'Próxima fecha', 'Registró', 'Observaciones'],
      registros.map((r) => [
        fecha(r.fecha_aplicacion), r.animal_nombre, r.especie, RegistroClinico.TIPOS[r.tipo], r.producto, r.dosis,
        fecha(r.proxima_fecha), r.registrado_por_nombre, r.observaciones,
      ]),
    );
  }

  const animales = await Animal.listar();
  return res.render('clinico/registros', {
    title: 'Historial clínico',
    registros,
    animales,
    filtros,
    animalFiltrado: filtros.animalId ? animales.find((a) => a.id === filtros.animalId) : null,
    tipos: RegistroClinico.TIPOS,
  });
}

// ?repetir=ID precarga el formulario con los datos de una aplicación anterior (siguiente dosis).
async function nuevo(req, res) {
  const registro = {
    animal_id: parsearId(req.query.animal_id),
    tipo: Object.hasOwn(RegistroClinico.TIPOS, req.query.tipo) ? req.query.tipo : '',
    producto: '',
    dosis: '',
    fecha_aplicacion: hoy(),
    proxima_fecha: '',
    observaciones: '',
  };
  const anteriorId = parsearId(req.query.repetir);
  const anterior = anteriorId ? await RegistroClinico.buscarPorId(anteriorId) : null;
  if (anterior) {
    Object.assign(registro, {
      animal_id: anterior.animal_id, tipo: anterior.tipo, producto: anterior.producto, dosis: anterior.dosis,
    });
  }
  await renderForm(res, { registro });
}

async function crear(req, res) {
  const datos = leerCuerpo(req.body);
  const errores = [...erroresDe(req), ...(await validarAnimal(datos))];
  if (errores.length) return renderForm(res, { registro: aFormulario(datos), errores }, 422);

  await RegistroClinico.crear({ ...datos, registradoPor: req.user.id });
  req.flash('exito', `${RegistroClinico.TIPOS[datos.tipo]} "${datos.producto}" registrada.`);
  return res.redirect(`${RUTA}?animal_id=${datos.animalId}`);
}

async function editar(req, res) {
  const registro = await cargarRegistro(req, res);
  if (!registro) return;
  await renderForm(res, { registro, actual: registro });
}

async function actualizar(req, res) {
  const actual = await cargarRegistro(req, res);
  if (!actual) return;
  const datos = leerCuerpo(req.body);
  const errores = [...erroresDe(req), ...(await validarAnimal(datos, actual))];
  if (errores.length) {
    await renderForm(res, { registro: aFormulario(datos, actual.id), errores, actual }, 422);
    return;
  }
  await RegistroClinico.actualizar(actual.id, datos);
  req.flash('exito', 'Registro clínico actualizado.');
  res.redirect(`${RUTA}?animal_id=${datos.animalId}`);
}

async function eliminar(req, res) {
  const registro = await cargarRegistro(req, res);
  if (!registro) return;
  await RegistroClinico.eliminar(registro.id);
  req.flash('exito', 'Registro clínico eliminado.');
  res.redirect(`${RUTA}?animal_id=${registro.animal_id}`);
}

// Reporte de próximas aplicaciones: vencidas + las que vencen dentro del horizonte elegido.
async function reporte(req, res) {
  const dias = HORIZONTES.includes(Number(req.query.dias)) ? Number(req.query.dias) : 30;
  const filtros = {
    dias,
    animalId: parsearId(req.query.animal_id) || undefined,
    tipo: Object.hasOwn(RegistroClinico.TIPOS, req.query.tipo) ? req.query.tipo : undefined,
  };
  const fechaHoy = hoy();
  const hasta = sumarDias(fechaHoy, dias);
  const pendientes = await RegistroClinico.pendientes({
    hoy: fechaHoy, hasta, animalId: filtros.animalId, tipo: filtros.tipo,
  });

  if (req.query.formato === 'csv') {
    return enviarCsv(
      res,
      `proximas-aplicaciones_${fechaHoy}_${dias}dias.csv`,
      ['Próxima fecha', 'Días restantes', 'Estado', 'Animal', 'Especie', 'Tipo', 'Producto', 'Dosis', 'Última aplicación'],
      pendientes.map((p) => [
        fecha(p.proxima_fecha), p.dias_restantes, p.dias_restantes < 0 ? 'Vencida' : 'Próxima', p.animal_nombre, p.especie,
        RegistroClinico.TIPOS[p.tipo], p.producto, p.dosis, fecha(p.fecha_aplicacion),
      ]),
    );
  }

  const vencidas = pendientes.filter((p) => p.dias_restantes < 0);
  const proximas = pendientes.filter((p) => p.dias_restantes >= 0);
  return res.render('clinico/reporte', {
    title: 'Próximas aplicaciones',
    filtros,
    hasta,
    vencidas,
    proximas,
    estaSemana: proximas.filter((p) => p.dias_restantes <= 7).length,
    animales: await Animal.listar({ activo: true }),
    tipos: RegistroClinico.TIPOS,
    horizontes: HORIZONTES,
  });
}

module.exports = {
  index, nuevo, crear, editar, actualizar, eliminar, reporte,
};
