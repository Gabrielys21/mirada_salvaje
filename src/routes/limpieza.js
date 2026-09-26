const express = require('express');
const { body } = require('express-validator');
const { requireRole } = require('../middlewares/auth');
const limpieza = require('../controllers/limpiezaController');
const areas = require('../controllers/areaController');
const Area = require('../models/area');
const RegistroLimpieza = require('../models/registroLimpieza');
const { esFechaValida } = require('../utils/helpers');

const router = express.Router();
const soloAdmin = requireRole('admin');

const reglasRegistro = [
  body('area_id').isInt({ min: 1 }).withMessage('Selecciona un área.'),
  body('fecha').custom(esFechaValida).withMessage('Ingresa una fecha válida.'),
  body('encargado_id').optional({ values: 'falsy' }).isInt({ min: 1 }).withMessage('Selecciona un encargado válido.'),
  body('estado').isIn(Object.keys(RegistroLimpieza.ESTADOS)).withMessage('Selecciona un estado válido.'),
  body('observaciones').optional().trim().isLength({ max: 500 }).withMessage('Las observaciones admiten máximo 500 caracteres.'),
];

const reglasArea = [
  body('nombre').trim().notEmpty().withMessage('El nombre es obligatorio.')
    .isLength({ max: 100 }).withMessage('El nombre admite máximo 100 caracteres.'),
  body('tipo').isIn(Object.keys(Area.TIPOS)).withMessage('Selecciona un tipo de área válido.'),
  body('descripcion').optional().trim().isLength({ max: 255 }).withMessage('La descripción admite máximo 255 caracteres.'),
];

router.get('/', (req, res) => res.redirect('/limpieza/registros'));

// Registros: cualquier usuario autenticado; el controlador restringe a los empleados a sus propios registros.
router.get('/registros', limpieza.index);
router.get('/registros/nuevo', limpieza.nuevo);
router.post('/registros', reglasRegistro, limpieza.crear);
router.get('/registros/:id/editar', limpieza.editar);
router.post('/registros/:id', reglasRegistro, limpieza.actualizar);
router.post('/registros/:id/completar', limpieza.completar);
router.post('/registros/:id/eliminar', soloAdmin, limpieza.eliminar);

// Áreas: consulta para todos, mantenimiento solo admin.
router.get('/areas', areas.index);
router.get('/areas/nueva', soloAdmin, areas.nueva);
router.post('/areas', soloAdmin, reglasArea, areas.crear);
router.get('/areas/:id/editar', soloAdmin, areas.editar);
router.post('/areas/:id', soloAdmin, reglasArea, areas.actualizar);
router.post('/areas/:id/eliminar', soloAdmin, areas.eliminar);

router.get('/reporte', limpieza.reporte);

module.exports = router;
