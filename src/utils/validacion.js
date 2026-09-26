const { validationResult } = require('express-validator');

// Devuelve los mensajes de error de express-validator (uno por campo).
function erroresDe(req) {
  return validationResult(req).array({ onlyFirstError: true }).map((e) => e.msg);
}

// 23503 = foreign_key_violation, 23001 = restrict_violation (ON DELETE RESTRICT).
function esErrorDeReferencia(err) {
  return err.code === '23503' || err.code === '23001';
}

// Errores de PostgreSQL que conviene mostrar al usuario en lugar de un 500.
function mensajeErrorBd(err, mensajes = {}) {
  if (err.code === '23505') return mensajes.duplicado || 'Ya existe un registro con esos datos.';
  if (esErrorDeReferencia(err)) return mensajes.referencia || 'El registro está relacionado con otros datos.';
  if (err.code === '23514') return mensajes.check || 'Algún valor no cumple las reglas permitidas.';
  return null;
}

// Regla de negocio incumplida (p. ej. stock insuficiente): el mensaje se muestra tal cual al usuario.
class ErrorNegocio extends Error {}

module.exports = { erroresDe, mensajeErrorBd, esErrorDeReferencia, ErrorNegocio };
