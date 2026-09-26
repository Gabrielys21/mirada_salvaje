const express = require('express');
const { body } = require('express-validator');
const rateLimit = require('express-rate-limit');
const auth = require('../controllers/authController');

const router = express.Router();

// Máximo 10 intentos fallidos cada 15 minutos por IP.
const limiteLogin = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: auth.limiteExcedido,
});

const reglasLogin = [
  body('username').trim().notEmpty().withMessage('Ingresa tu usuario.').isLength({ max: 50 }).withMessage('Usuario no válido.'),
  body('password').notEmpty().withMessage('Ingresa tu contraseña.').isLength({ max: 72 }).withMessage('Contraseña no válida.'),
];

router.get('/login', auth.mostrarLogin);
router.post('/login', limiteLogin, reglasLogin, auth.login);
router.post('/logout', auth.logout);

module.exports = router;
