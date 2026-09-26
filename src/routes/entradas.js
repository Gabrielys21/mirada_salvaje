const express = require('express');
const { body } = require('express-validator');
const { requireRole } = require('../middlewares/auth');
const tipos = require('../controllers/tipoEntradaController');
const promociones = require('../controllers/promocionController');
const ventas = require('../controllers/ventaController');
const { esFechaValida, parsearDecimal } = require('../utils/helpers');

const router = express.Router();
const soloAdmin = requireRole('admin');

const MAXIMO_CANTIDAD_VENTA = 100;

const reglasTipo = [
  body('nombre').trim().notEmpty().withMessage('El nombre es obligatorio.')
    .isLength({ max: 50 }).withMessage('El nombre admite máximo 50 caracteres.'),
  body('precio').custom((v) => {
    const n = parsearDecimal(v);
    return n !== null && n >= 0 && n <= 99999999.99;
  }).withMessage('El precio debe ser un número mayor o igual a 0 (usa punto decimal).'),
  body('descripcion').optional().trim().isLength({ max: 255 }).withMessage('La descripción admite máximo 255 caracteres.'),
];

const reglasPromocion = [
  body('nombre').trim().notEmpty().withMessage('El nombre es obligatorio.')
    .isLength({ max: 100 }).withMessage('El nombre admite máximo 100 caracteres.'),
  body('descripcion').optional().trim().isLength({ max: 255 }).withMessage('La descripción admite máximo 255 caracteres.'),
  body('porcentaje_descuento').custom((v) => {
    const n = parsearDecimal(v);
    return n !== null && n > 0 && n <= 100;
  }).withMessage('El descuento debe ser un porcentaje mayor que 0 y hasta 100.'),
  body('fecha_inicio').custom(esFechaValida).withMessage('Ingresa una fecha de inicio válida.'),
  body('fecha_fin')
    .custom((v, { req }) => esFechaValida(v) && (!esFechaValida(req.body.fecha_inicio) || v >= req.body.fecha_inicio))
    .withMessage('La fecha de fin debe ser válida e igual o posterior a la de inicio.'),
  body('tipo_entrada_id').optional({ values: 'falsy' }).isInt({ min: 1 }).withMessage('Tipo de entrada no válido.'),
];

const reglasVenta = [
  body('tipo_entrada_id').isInt({ min: 1 }).withMessage('Selecciona un tipo de entrada.'),
  body('cantidad').isInt({ min: 1, max: MAXIMO_CANTIDAD_VENTA })
    .withMessage(`La cantidad debe ser un número entero entre 1 y ${MAXIMO_CANTIDAD_VENTA}.`),
];

router.get('/', (req, res) => res.redirect('/entradas/ventas/nueva'));

// Tipos de entrada y promociones: consulta para todos, mantenimiento solo admin.
router.get('/tipos', tipos.index);
router.get('/tipos/nuevo', soloAdmin, tipos.nuevo);
router.post('/tipos', soloAdmin, reglasTipo, tipos.crear);
router.get('/tipos/:id/editar', soloAdmin, tipos.editar);
router.post('/tipos/:id', soloAdmin, reglasTipo, tipos.actualizar);
router.post('/tipos/:id/eliminar', soloAdmin, tipos.eliminar);

router.get('/promociones', promociones.index);
router.get('/promociones/nueva', soloAdmin, promociones.nueva);
router.post('/promociones', soloAdmin, reglasPromocion, promociones.crear);
router.get('/promociones/:id/editar', soloAdmin, promociones.editar);
router.post('/promociones/:id', soloAdmin, reglasPromocion, promociones.actualizar);
router.post('/promociones/:id/eliminar', soloAdmin, promociones.eliminar);

// Ventas: cualquier usuario vende; solo admin anula.
router.get('/ventas', ventas.index);
router.get('/ventas/nueva', ventas.nueva);
router.post('/ventas', reglasVenta, ventas.crear);
router.get('/ventas/:id', ventas.detalle);
router.post('/ventas/:id/eliminar', soloAdmin, ventas.eliminar);

router.get('/reporte', ventas.reporte);

module.exports = router;
