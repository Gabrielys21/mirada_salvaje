const Usuario = require('../models/usuario');

// Exige sesión iniciada y recarga el usuario desde la base en cada petición,
// así un usuario desactivado o con rol cambiado pierde el acceso de inmediato.
async function requireAuth(req, res, next) {
  const sesion = req.session.user;
  if (sesion) {
    const usuario = await Usuario.buscarPorId(sesion.id);
    if (usuario && usuario.activo) {
      req.user = usuario;
      req.session.user = { id: usuario.id, nombre: usuario.nombre, username: usuario.username, rol: usuario.rol };
      res.locals.currentUser = req.session.user;
      return next();
    }
    delete req.session.user;
  }
  if (req.method === 'GET') req.session.returnTo = req.originalUrl;
  return res.redirect('/login');
}

// Uso: router.get('/ruta', requireAuth, requireRole('admin'), handler)
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.redirect('/login');
    if (!roles.includes(req.user.rol)) {
      const err = new Error('No tienes permiso para acceder a esta sección.');
      err.status = 403;
      return next(err);
    }
    return next();
  };
}

function esAdmin(req) {
  return Boolean(req.user && req.user.rol === 'admin');
}

module.exports = { requireAuth, requireRole, esAdmin };
