const RegistroLimpieza = require('../models/registroLimpieza');
const Area = require('../models/area');
const Usuario = require('../models/usuario');
const { esAdmin } = require('../middlewares/auth');
const { erroresDe } = require('../utils/validacion');
const { enviarCsv } = require('../utils/csv');
const {
  hoy, primerDiaDelMes, esFechaValida, parsearId, fecha,
} = require('../utils/helpers');

const RUTA = '/limpieza/registros';

// ---------- Utilidades internas ----------

function leerFiltros(q, porDefecto = {}) {
  const filtros = {
    desde: esFechaValida(q.desde) ? q.desde : porDefecto.desde,
    hasta: esFechaValida(q.hasta) ? q.hasta : porDefecto.hasta,
    areaId: parsearId(q.area_id) || undefined,
    estado: Object.hasOwn(RegistroLimpieza.ESTADOS, q.estado) ? q.estado : undefined,
  };
  if (filtros.desde && filtros.hasta && filtros.desde > filtros.hasta) {
    [filtros.desde, filtros.hasta] = [filtros.hasta, filtros.desde];
  }
  return filtros;
}

function puedeGestionar(req, registro) {
  return esAdmin(req) || registro.encargado_id === req.user.id;
}

// Un empleado solo puede asignarse tareas a sí mismo.
function leerCuerpo(req) {
  const b = req.body;
  return {
    areaId: parsearId(b.area_id),
    fecha: b.fecha,
    encargadoId: esAdmin(req) ? parsearId(b.encargado_id) : req.user.id,
    estado: b.estado,
    observaciones: String(b.observaciones || '').trim(),
  };
}

function aFormulario(datos, id) {
  return {
    id,
    area_id: datos.areaId,
    fecha: datos.fecha,
    encargado_id: datos.encargadoId,
    estado: datos.estado,
    observaciones: datos.observaciones,
  };
}

// Verifica que el área y el encargado existan y estén activos
// (se admite conservar los que ya tenía el registro aunque se hayan desactivado).
async function validarReferencias(req, datos, actual) {
  const errores = [];
  if (esAdmin(req) && !datos.encargadoId) errores.push('Selecciona un encargado.');
  if (datos.areaId) {
    const area = await Area.buscarPorId(datos.areaId);
    if (!area || (!area.activo && area.id !== (actual && actual.area_id))) {
      errores.push('El área seleccionada no está disponible.');
    }
  }
  if (datos.encargadoId) {
    const encargado = await Usuario.buscarPorId(datos.encargadoId);
    if (!encargado || (!encargado.activo && encargado.id !== (actual && actual.encargado_id))) {
      errores.push('El encargado seleccionado no está disponible.');
    }
  }
  return errores;
}

async function renderForm(req, res, { registro, errores = [], actual }, status = 200) {
  const [areasActivas, encargadosActivos] = await Promise.all([
    Area.listar({ soloActivas: true }),
    esAdmin(req) ? Usuario.listarActivos() : Promise.resolve([req.user]),
  ]);
  // Si el registro apunta a un área o encargado ya desactivado, se muestra igualmente.
  const areas = [...areasActivas];
  const encargados = [...encargadosActivos];
  if (actual && !areas.some((a) => a.id === actual.area_id)) {
    areas.push({ id: actual.area_id, nombre: `${actual.area_nombre} (inactiva)`, tipo: actual.area_tipo });
  }
  if (actual && !encargados.some((u) => u.id === actual.encargado_id)) {
    encargados.push({ id: actual.encargado_id, nombre: `${actual.encargado_nombre} (inactivo)` });
  }
  res.status(status).render('limpieza/registro-form', {
    title: registro.id ? 'Editar registro de limpieza' : 'Nuevo registro de limpieza',
    registro,
    errores,
    areas,
    encargados,
    estados: RegistroLimpieza.ESTADOS,
    tipos: Area.TIPOS,
    admin: esAdmin(req),
  });
}

async function cargarRegistro(req, res) {
  const id = parsearId(req.params.id);
  const registro = id ? await RegistroLimpieza.buscarPorId(id) : null;
  if (!registro) {
    req.flash('error', 'El registro de limpieza no existe.');
    res.redirect(RUTA);
    return null;
  }
  if (!puedeGestionar(req, registro)) {
    req.flash('error', 'Solo puedes modificar los registros asignados a ti.');
    res.redirect(RUTA);
    return null;
  }
  return registro;
}

// ---------- Acciones ----------

async function index(req, res) {
  const filtros = leerFiltros(req.query);
  const mias = req.query.mias === '1';
  if (mias) filtros.encargadoId = req.user.id;
  const [registros, areas] = await Promise.all([RegistroLimpieza.listar(filtros), Area.listar()]);
  res.render('limpieza/registros', {
    title: 'Registros de limpieza',
    registros,
    areas,
    filtros: { ...filtros, mias },
    estados: RegistroLimpieza.ESTADOS,
    tipos: Area.TIPOS,
  });
}

async function nuevo(req, res) {
  await renderForm(req, res, {
    registro: {
      area_id: parsearId(req.query.area_id), fecha: hoy(), encargado_id: req.user.id, estado: 'pendiente', observaciones: '',
    },
  });
}

async function crear(req, res) {
  const datos = leerCuerpo(req);
  const errores = [...erroresDe(req), ...(await validarReferencias(req, datos))];
  if (errores.length) return renderForm(req, res, { registro: aFormulario(datos), errores }, 422);

  await RegistroLimpieza.crear(datos);
  req.flash('exito', 'Registro de limpieza creado.');
  return res.redirect(RUTA);
}

async function editar(req, res) {
  const registro = await cargarRegistro(req, res);
  if (!registro) return;
  await renderForm(req, res, { registro, actual: registro });
}

async function actualizar(req, res) {
  const actual = await cargarRegistro(req, res);
  if (!actual) return;
  const datos = leerCuerpo(req);
  const errores = [...erroresDe(req), ...(await validarReferencias(req, datos, actual))];
  if (errores.length) {
    await renderForm(req, res, { registro: aFormulario(datos, actual.id), errores, actual }, 422);
    return;
  }
  await RegistroLimpieza.actualizar(actual.id, datos);
  req.flash('exito', 'Registro de limpieza actualizado.');
  res.redirect(RUTA);
}

async function completar(req, res) {
  const registro = await cargarRegistro(req, res);
  if (!registro) return;
  await RegistroLimpieza.cambiarEstado(registro.id, 'completado');
  req.flash('exito', `Limpieza de "${registro.area_nombre}" marcada como completada.`);
  // Vuelve al listado filtrado desde donde se pulsó el botón (solo rutas internas del módulo).
  const volver = String(req.body.volver || '');
  res.redirect(volver.startsWith('/limpieza/') ? volver : RUTA);
}

async function eliminar(req, res) {
  const registro = await cargarRegistro(req, res);
  if (!registro) return;
  await RegistroLimpieza.eliminar(registro.id);
  req.flash('exito', 'Registro de limpieza eliminado.');
  res.redirect(RUTA);
}

async function reporte(req, res) {
  const filtros = leerFiltros(req.query, { desde: primerDiaDelMes(), hasta: hoy() });
  const [resumen, detalle, areas] = await Promise.all([
    RegistroLimpieza.resumenPorArea(filtros),
    RegistroLimpieza.listar(filtros, { limite: 5000 }),
    Area.listar(),
  ]);

  if (req.query.formato === 'csv') {
    return enviarCsv(
      res,
      `reporte-limpieza_${filtros.desde}_${filtros.hasta}.csv`,
      ['Fecha', 'Área', 'Tipo de área', 'Encargado', 'Estado', 'Observaciones'],
      detalle.map((r) => [
        fecha(r.fecha), r.area_nombre, Area.TIPOS[r.area_tipo], r.encargado_nombre,
        RegistroLimpieza.ESTADOS[r.estado], r.observaciones,
      ]),
    );
  }

  const totales = resumen.reduce(
    (acc, fila) => ({
      total: acc.total + fila.total,
      completados: acc.completados + fila.completados,
      pendientes: acc.pendientes + fila.pendientes,
    }),
    { total: 0, completados: 0, pendientes: 0 },
  );
  return res.render('limpieza/reporte', {
    title: 'Reporte de limpieza',
    filtros,
    resumen,
    detalle,
    totales,
    areas,
    estados: RegistroLimpieza.ESTADOS,
    tipos: Area.TIPOS,
  });
}

module.exports = {
  index, nuevo, crear, editar, actualizar, completar, eliminar, reporte,
};
