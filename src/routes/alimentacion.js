const express = require('express');
const { body } = require('express-validator');
const { requireRole } = require('../middlewares/auth');
const animales = require('../controllers/animalController');
const dietas = require('../controllers/dietaController');
const inventario = require('../controllers/alimentoController');
const movimientos = require('../controllers/movimientoController');
const alimentacion = require('../controllers/alimentacionController');
const Animal = require('../models/animal');
const Alimento = require('../models/alimento');
const Movimiento = require('../models/movimientoInventario');
const { esFechaValida, hoy, parsearDecimal } = require('../utils/helpers');

const router = express.Router();
const soloAdmin = requireRole('admin');

const MAXIMO = 99999999.99; // NUMERIC(10,2)
const esCantidadPositiva = (v) => {
  const n = parsearDecimal(v);
  return n !== null && n > 0 && n <= MAXIMO;
};
const esCantidadNoNegativa = (v) => {
  const n = parsearDecimal(v);
  return n !== null && n >= 0 && n <= MAXIMO;
};
const esFechaPasada = (v) => esFechaValida(v) && v <= hoy();

const reglasAnimal = [
  body('nombre').trim().notEmpty().withMessage('El nombre es obligatorio.')
    .isLength({ max: 100 }).withMessage('El nombre admite máximo 100 caracteres.'),
  body('especie').trim().notEmpty().withMessage('La especie es obligatoria.')
    .isLength({ max: 100 }).withMessage('La especie admite máximo 100 caracteres.'),
  body('sexo').optional({ values: 'falsy' }).isIn(Object.keys(Animal.SEXOS)).withMessage('Sexo no válido.'),
  body('fecha_nacimiento').optional({ values: 'falsy' }).custom(esFechaPasada)
    .withMessage('La fecha de nacimiento debe ser válida y no futura.'),
  body('area_id').optional({ values: 'falsy' }).isInt({ min: 1 }).withMessage('Área no válida.'),
  body('observaciones').optional().trim().isLength({ max: 500 }).withMessage('Las observaciones admiten máximo 500 caracteres.'),
];

const reglasDieta = [
  body('animal_id').isInt({ min: 1 }).withMessage('Selecciona un animal.'),
  body('alimento_id').isInt({ min: 1 }).withMessage('Selecciona un alimento.'),
  body('cantidad').custom(esCantidadPositiva).withMessage('La cantidad debe ser un número mayor que 0 (usa punto decimal).'),
  body('horario').matches(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/).withMessage('Ingresa un horario válido (HH:MM).'),
  body('observaciones').optional().trim().isLength({ max: 255 }).withMessage('Las observaciones admiten máximo 255 caracteres.'),
];

const reglasAlimento = [
  body('nombre').trim().notEmpty().withMessage('El nombre es obligatorio.')
    .isLength({ max: 100 }).withMessage('El nombre admite máximo 100 caracteres.'),
  body('tipo').isIn(Object.keys(Alimento.TIPOS)).withMessage('Selecciona un tipo de alimento válido.'),
  body('unidad').isIn(Object.keys(Alimento.UNIDADES)).withMessage('Selecciona una unidad válida.'),
  body('stock_minimo').optional({ values: 'falsy' }).custom(esCantidadNoNegativa)
    .withMessage('El stock mínimo debe ser un número mayor o igual a 0.'),
  body('stock_inicial').optional({ values: 'falsy' }).custom(esCantidadNoNegativa)
    .withMessage('El stock inicial debe ser un número mayor o igual a 0.'),
];

const reglasMovimiento = [
  body('alimento_id').isInt({ min: 1 }).withMessage('Selecciona un alimento.'),
  body('tipo').isIn(Object.keys(Movimiento.TIPOS)).withMessage('Selecciona entrada o salida.'),
  body('cantidad').custom(esCantidadPositiva).withMessage('La cantidad debe ser un número mayor que 0 (usa punto decimal).'),
  body('fecha').custom(esFechaPasada).withMessage('La fecha debe ser válida y no futura.'),
  body('observaciones').optional().trim().isLength({ max: 255 }).withMessage('Las observaciones admiten máximo 255 caracteres.'),
];

router.get('/', (req, res) => res.redirect('/alimentacion/animales'));

// Animales: consulta para todos, mantenimiento solo admin.
router.get('/animales', animales.index);
router.get('/animales/nuevo', soloAdmin, animales.nuevo);
router.post('/animales', soloAdmin, reglasAnimal, animales.crear);
router.get('/animales/:id', animales.detalle);
router.get('/animales/:id/editar', soloAdmin, animales.editar);
router.post('/animales/:id', soloAdmin, reglasAnimal, animales.actualizar);
router.post('/animales/:id/eliminar', soloAdmin, animales.eliminar);

// Dietas: consulta para todos, mantenimiento solo admin.
router.get('/dietas', dietas.index);
router.get('/dietas/nueva', soloAdmin, dietas.nueva);
router.post('/dietas', soloAdmin, reglasDieta, dietas.crear);
router.get('/dietas/:id/editar', soloAdmin, dietas.editar);
router.post('/dietas/:id', soloAdmin, reglasDieta, dietas.actualizar);
router.post('/dietas/:id/eliminar', soloAdmin, dietas.eliminar);

// Inventario: catálogo solo admin; el stock cambia únicamente con movimientos.
router.get('/inventario', inventario.index);
router.get('/inventario/nuevo', soloAdmin, inventario.nuevo);
router.post('/inventario', soloAdmin, reglasAlimento, inventario.crear);
router.get('/inventario/:id', inventario.detalle);
router.get('/inventario/:id/editar', soloAdmin, inventario.editar);
router.post('/inventario/:id', soloAdmin, reglasAlimento, inventario.actualizar);
router.post('/inventario/:id/eliminar', soloAdmin, inventario.eliminar);

// Movimientos: cualquier usuario registra entradas y salidas; solo admin las anula.
router.get('/movimientos', movimientos.index);
router.get('/movimientos/nuevo', movimientos.nuevo);
router.post('/movimientos', reglasMovimiento, movimientos.crear);
router.post('/movimientos/:id/eliminar', soloAdmin, movimientos.eliminar);

router.get('/reporte', alimentacion.reporte);

module.exports = router;
