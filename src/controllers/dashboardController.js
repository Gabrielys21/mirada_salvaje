const RegistroLimpieza = require('../models/registroLimpieza');
const Alimento = require('../models/alimento');
const RegistroClinico = require('../models/registroClinico');
const VentaEntrada = require('../models/ventaEntrada');
const Promocion = require('../models/promocion');
const { hoy, sumarDias } = require('../utils/helpers');

async function inicio(req, res) {
  const fechaHoy = hoy();
  const [limpiezasPendientes, misLimpiezasPendientes, alimentosBajos, clinico, ventasHoy, promocionesVigentes] = await Promise.all([
    RegistroLimpieza.contarPendientes({ hasta: fechaHoy }),
    RegistroLimpieza.contarPendientes({ hasta: fechaHoy, encargadoId: req.user.id }),
    Alimento.contarBajos(),
    RegistroClinico.contarPendientes({ hoy: fechaHoy, hasta: sumarDias(fechaHoy, 7) }),
    VentaEntrada.resumen({ desde: fechaHoy, hasta: fechaHoy }).then((r) => r.totales),
    Promocion.contarVigentes(fechaHoy),
  ]);
  res.render('dashboard', {
    title: 'Inicio',
    limpiezasPendientes,
    misLimpiezasPendientes,
    alimentosBajos,
    clinico,
    ventasHoy,
    promocionesVigentes,
  });
}

module.exports = { inicio };
