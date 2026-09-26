const helpers = require('../utils/helpers');

// Variables disponibles en todas las vistas y mensajes flash de una sola lectura.
function exposeLocals(req, res, next) {
  res.locals.currentUser = req.session.user || null;
  res.locals.currentPath = req.path;
  res.locals.currentUrl = req.originalUrl;
  res.locals.h = helpers;
  res.locals.flash = req.session.flash || null;
  delete req.session.flash;
  req.flash = (tipo, mensaje) => {
    req.session.flash = { tipo, mensaje };
  };
  next();
}

module.exports = { exposeLocals };
