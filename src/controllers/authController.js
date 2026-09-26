const Usuario = require('../models/usuario');
const { erroresDe } = require('../utils/validacion');

const TITULO = 'Iniciar sesión';

function renderLogin(res, { errores = [], username = '' } = {}, status = 200) {
  res.status(status).render('auth/login', { title: TITULO, errores, username });
}

// Solo se permite volver a rutas internas (evita redirecciones abiertas).
function destinoSeguro(ruta) {
  return typeof ruta === 'string' && ruta.startsWith('/') && !ruta.startsWith('//') ? ruta : '/';
}

function mostrarLogin(req, res) {
  if (req.session.user) return res.redirect('/');
  return renderLogin(res);
}

async function login(req, res, next) {
  const username = String(req.body.username || '').trim();
  const errores = erroresDe(req);
  if (errores.length) return renderLogin(res, { errores, username }, 422);

  const usuario = await Usuario.verificarCredenciales(username, req.body.password);
  if (!usuario) return renderLogin(res, { errores: ['Usuario o contraseña incorrectos.'], username }, 401);

  const destino = destinoSeguro(req.session.returnTo);
  // Nueva sesión al autenticarse para evitar fijación de sesión.
  return req.session.regenerate((err) => {
    if (err) return next(err);
    req.session.user = { id: usuario.id, nombre: usuario.nombre, username: usuario.username, rol: usuario.rol };
    return req.session.save((errGuardar) => (errGuardar ? next(errGuardar) : res.redirect(destino)));
  });
}

function limiteExcedido(req, res) {
  renderLogin(res, {
    errores: ['Demasiados intentos fallidos. Espera unos minutos e inténtalo de nuevo.'],
    username: String(req.body.username || '').trim(),
  }, 429);
}

function logout(req, res, next) {
  req.session.destroy((err) => {
    if (err) return next(err);
    res.clearCookie('msid');
    return res.redirect('/login');
  });
}

module.exports = { mostrarLogin, login, limiteExcedido, logout };
