const ZONA_HORARIA = 'America/Guatemala';

const formatoIso = new Intl.DateTimeFormat('en-CA', { timeZone: ZONA_HORARIA });
const formatoFechaHora = new Intl.DateTimeFormat('es-GT', {
  timeZone: ZONA_HORARIA, dateStyle: 'short', timeStyle: 'short',
});

// Fecha de hoy en Guatemala como 'YYYY-MM-DD'.
function hoy() {
  return formatoIso.format(new Date());
}

function primerDiaDelMes() {
  return `${hoy().slice(0, 8)}01`;
}

// sumarDias('2026-09-25', 7) -> '2026-10-02'
function sumarDias(fechaIso, dias) {
  const d = new Date(`${fechaIso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

function esFechaValida(texto) {
  if (typeof texto !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(texto)) return false;
  const d = new Date(`${texto}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === texto;
}

// 'YYYY-MM-DD' -> 'dd/mm/yyyy'
function fecha(valor) {
  if (!valor) return '';
  const [a, m, d] = String(valor).slice(0, 10).split('-');
  return `${d}/${m}/${a}`;
}

function fechaHora(valor) {
  return valor ? formatoFechaHora.format(new Date(valor)) : '';
}

function moneda(valor) {
  return `Q ${Number(valor || 0).toFixed(2)}`;
}

function parsearId(valor) {
  const n = Number(valor);
  return Number.isInteger(n) && n > 0 ? n : null;
}

const formatoCantidad = new Intl.NumberFormat('es-GT', { maximumFractionDigits: 2 });

// 12.5 -> '12.5', 1000 -> '1,000'
function cantidad(valor) {
  return formatoCantidad.format(Number(valor || 0));
}

// 'HH:MM:SS' -> 'HH:MM'
function hora(valor) {
  return valor ? String(valor).slice(0, 5) : '';
}

// Número redondeado a 2 decimales, o null si no es válido.
function parsearDecimal(valor) {
  if (valor === undefined || valor === null || String(valor).trim() === '') return null;
  const n = Number(valor);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

module.exports = {
  ZONA_HORARIA, hoy, primerDiaDelMes, sumarDias, esFechaValida, fecha, fechaHora, moneda, parsearId, cantidad, hora, parsearDecimal,
};
