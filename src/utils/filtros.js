// Construye un WHERE parametrizado a partir de condiciones opcionales.
// Uso: const w = new Filtro(); w.agregar('r.fecha >= ?', desde); w.sql -> 'WHERE r.fecha >= $1'
class Filtro {
  constructor() {
    this.condiciones = [];
    this.parametros = [];
  }

  agregar(condicion, valor) {
    if (valor === undefined || valor === null || valor === '') return this;
    this.parametros.push(valor);
    // Todos los '?' de la condición usan el mismo parámetro.
    this.condiciones.push(condicion.replaceAll('?', `$${this.parametros.length}`));
    return this;
  }

  // Búsqueda parcial sin distinguir mayúsculas; escapa los comodines de LIKE.
  agregarTexto(condicion, texto) {
    const limpio = String(texto || '').trim();
    return this.agregar(condicion, limpio ? `%${limpio.replace(/[\\%_]/g, '\\$&')}%` : undefined);
  }

  get sql() {
    return this.condiciones.length ? `WHERE ${this.condiciones.join(' AND ')}` : '';
  }
}

module.exports = { Filtro };
