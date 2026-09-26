// Genera CSV compatible con Excel (BOM UTF-8, separador coma).
function celda(valor) {
  let texto = valor === null || valor === undefined ? '' : String(valor);
  // Evita inyección de fórmulas al abrir el archivo en Excel (los números, p. ej. -2, se dejan tal cual).
  if (typeof valor === 'string' && /^[=+\-@\t\r]/.test(texto)) texto = `'${texto}`;
  return /[",\n\r]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

function aCsv(encabezados, filas) {
  const lineas = [encabezados, ...filas].map((fila) => fila.map(celda).join(','));
  return `﻿${lineas.join('\r\n')}\r\n`;
}

function enviarCsv(res, nombreArchivo, encabezados, filas) {
  res.set('Content-Type', 'text/csv; charset=utf-8');
  res.attachment(nombreArchivo);
  res.send(aCsv(encabezados, filas));
}

module.exports = { aCsv, enviarCsv };
