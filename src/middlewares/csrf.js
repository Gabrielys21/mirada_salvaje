const crypto = require('crypto');

const METODOS_SEGUROS = new Set(['GET', 'HEAD', 'OPTIONS']);

// Token sincronizado en sesión: todo formulario POST debe incluir <input name="_csrf">.
function csrfProtection(req, res, next) {
  if (!req.session.csrfToken) req.session.csrfToken = crypto.randomBytes(24).toString('hex');
  res.locals.csrfToken = req.session.csrfToken;
  if (METODOS_SEGUROS.has(req.method)) return next();

  const enviado = Buffer.from(String((req.body && req.body._csrf) || ''));
  const esperado = Buffer.from(req.session.csrfToken);
  if (enviado.length !== esperado.length || !crypto.timingSafeEqual(enviado, esperado)) {
    const err = new Error('El formulario expiró o no es válido. Recarga la página e inténtalo de nuevo.');
    err.status = 403;
    return next(err);
  }
  return next();
}

module.exports = { csrfProtection };
