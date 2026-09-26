const Usuario = require('../models/usuario');
const { erroresDe, mensajeErrorBd } = require('../utils/validacion');
const { parsearId } = require('../utils/helpers');

const RUTA = '/usuarios';

function renderForm(res, { usuario, errores = [] }, status = 200) {
  res.status(status).render('usuarios/form', {
    title: usuario.id ? 'Editar usuario' : 'Nuevo usuario',
    usuario,
    errores,
    roles: Usuario.ROLES,
    minimoPassword: Usuario.LONGITUD_MINIMA_PASSWORD,
  });
}

async function cargarUsuario(req, res) {
  const id = parsearId(req.params.id);
  const usuario = id ? await Usuario.buscarPorId(id) : null;
  if (!usuario) {
    req.flash('error', 'El usuario no existe.');
    res.redirect(RUTA);
  }
  return usuario;
}

async function index(req, res) {
  const usuarios = await Usuario.listar();
  res.render('usuarios/index', { title: 'Usuarios', usuarios, roles: Usuario.ROLES });
}

function nuevo(req, res) {
  renderForm(res, { usuario: { nombre: '', username: '', rol: 'empleado', activo: true } });
}

async function crear(req, res) {
  const datos = {
    nombre: String(req.body.nombre || '').trim(),
    username: String(req.body.username || '').trim(),
    rol: req.body.rol,
    password: String(req.body.password || ''),
  };
  const errores = erroresDe(req);
  if (!errores.length) {
    try {
      await Usuario.crear(datos);
      req.flash('exito', `Usuario "${datos.username.toLowerCase()}" creado.`);
      return res.redirect(RUTA);
    } catch (err) {
      const mensaje = mensajeErrorBd(err, { duplicado: 'Ese nombre de usuario ya está en uso.' });
      if (!mensaje) throw err;
      errores.push(mensaje);
    }
  }
  return renderForm(res, { usuario: { ...datos, password: undefined, activo: true }, errores }, 422);
}

async function editar(req, res) {
  const usuario = await cargarUsuario(req, res);
  if (!usuario) return;
  renderForm(res, { usuario });
}

async function actualizar(req, res) {
  const usuario = await cargarUsuario(req, res);
  if (!usuario) return;
  const esUnoMismo = usuario.id === req.user.id;
  const datos = {
    nombre: String(req.body.nombre || '').trim(),
    // Un admin no puede quitarse el rol ni desactivarse a sí mismo (evita quedarse sin administradores).
    rol: esUnoMismo ? usuario.rol : req.body.rol,
    activo: esUnoMismo ? true : req.body.activo === 'on',
  };
  const password = String(req.body.password || '');
  const errores = erroresDe(req);
  if (errores.length) {
    renderForm(res, { usuario: { ...usuario, ...datos }, errores }, 422);
    return;
  }
  await Usuario.actualizar(usuario.id, datos);
  if (password) await Usuario.cambiarPassword(usuario.id, password);
  req.flash('exito', `Usuario "${usuario.username}" actualizado.`);
  res.redirect(RUTA);
}

module.exports = { index, nuevo, crear, editar, actualizar };
