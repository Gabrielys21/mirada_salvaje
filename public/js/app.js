// Confirmación antes de enviar formularios destructivos: <form data-confirm="¿Seguro?">
document.addEventListener('submit', (evento) => {
  const mensaje = evento.target.dataset.confirm;
  if (mensaje && !window.confirm(mensaje)) evento.preventDefault();
});

// Botones de impresión: <button data-print>
document.addEventListener('click', (evento) => {
  if (evento.target.closest('[data-print]')) window.print();
});

// Total estimado en el formulario de venta: <form data-venta>. Usa la misma fórmula que el servidor.
const formVenta = document.querySelector('form[data-venta]');
if (formVenta) {
  const tipo = formVenta.querySelector('select[name="tipo_entrada_id"]');
  const cantidad = formVenta.querySelector('input[name="cantidad"]');
  const total = formVenta.querySelector('[data-total]');
  const calcular = () => {
    const opcion = tipo.selectedOptions[0];
    const precio = Number(opcion && opcion.dataset.precio);
    const descuento = Number((opcion && opcion.dataset.descuento) || 0);
    const n = Number.parseInt(cantidad.value, 10);
    total.textContent = precio >= 0 && opcion && opcion.value && n > 0
      ? `Q ${(Math.round(precio * n * (100 - descuento)) / 100).toFixed(2)}`
      : '—';
  };
  tipo.addEventListener('change', calcular);
  cantidad.addEventListener('input', calcular);
  calcular();
}
