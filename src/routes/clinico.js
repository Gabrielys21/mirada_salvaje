const express = require('express');
const { body } = require('express-validator');
const { requireRole } = require('../middlewares/auth');
const clinico = require('../controllers/clinicoController');
const RegistroClinico = require('../models/registroClinico');
const { esFechaValida, hoy } = require('../utils/helpers');

const router = express.Router();
const soloAdmin = requireRole('admin');

const reglasRegistro = [
  body('animal_id').isInt({ min: 1 }).withMessage('Selecciona un animal.'),
  body('tipo').isIn(Object.keys(RegistroClinico.TIPOS)).withMessage('Selecciona medicamento, vacuna o vitamina.'),
  body('producto').trim().notEmpty().withMessage('Indica el producto aplicado.')
    .isLength({ max: 100 }).withMessage('El producto admite máximo 100 caracteres.'),
  body('dosis').trim().notEmpty().withMessage('Indica la dosis.')
    .isLength({ max: 50 }).withMessage('La dosis admite máximo 50 caracteres.'),
  body('fecha_aplicacion').custom((v) => esFechaValida(v) && v <= hoy())
    .withMessage('La fecha de aplicación debe ser válida y no futura.'),
  body('proxima_fecha').optional({ values: 'falsy' })
    .custom((v, { req }) => esFechaValida(v) && (!esFechaValida(req.body.fecha_aplicacion) || v >= req.body.fecha_aplicacion))
    .withMessage('La próxima fecha debe ser válida e igual o posterior a la fecha de aplicación.'),
  body('observaciones').optional().trim().isLength({ max: 500 }).withMessage('Las observaciones admiten máximo 500 caracteres.'),
];

router.get('/', (req, res) => res.redirect('/clinico/registros'));

// Cualquier usuario registra aplicaciones; el controlador limita a los empleados a editar las suyas.
router.get('/registros', clinico.index);
router.get('/registros/nuevo', clinico.nuevo);
router.post('/registros', reglasRegistro, clinico.crear);
router.get('/registros/:id/editar', clinico.editar);
router.post('/registros/:id', reglasRegistro, clinico.actualizar);
router.post('/registros/:id/eliminar', soloAdmin, clinico.eliminar);

router.get('/reporte', clinico.reporte);

module.exports = router;
