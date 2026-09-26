const express = require('express');
const { body } = require('express-validator');
const usuarios = require('../controllers/usuarioController');
const Usuario = require('../models/usuario');

const router = express.Router();
const MINIMO = Usuario.LONGITUD_MINIMA_PASSWORD;

const reglasComunes = [
  body('nombre').trim().notEmpty().withMessage('El nombre es obligatorio.')
    .isLength({ max: 100 }).withMessage('El nombre admite máximo 100 caracteres.'),
];

const reglaRol = body('rol').isIn(Object.keys(Usuario.ROLES)).withMessage('Selecciona un rol válido.');

const reglaConfirmacion = body('password_confirmacion')
  .custom((valor, { req }) => valor === req.body.password)
  .withMessage('Las contraseñas no coinciden.');

const reglasCrear = [
  ...reglasComunes,
  body('username').trim().matches(/^[a-zA-Z0-9._-]{3,50}$/)
    .withMessage('El usuario debe tener de 3 a 50 caracteres: letras, números, punto, guion o guion bajo.'),
  reglaRol,
  body('password').isLength({ min: MINIMO, max: 72 }).withMessage(`La contraseña debe tener entre ${MINIMO} y 72 caracteres.`),
  reglaConfirmacion,
];

const reglasActualizar = [
  ...reglasComunes,
  reglaRol,
  body('password').optional({ values: 'falsy' }).isLength({ min: MINIMO, max: 72 })
    .withMessage(`La nueva contraseña debe tener entre ${MINIMO} y 72 caracteres.`),
  reglaConfirmacion,
];

router.get('/', usuarios.index);
router.get('/nuevo', usuarios.nuevo);
router.post('/', reglasCrear, usuarios.crear);
router.get('/:id/editar', usuarios.editar);
router.post('/:id', reglasActualizar, usuarios.actualizar);

module.exports = router;
