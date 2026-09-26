const express = require('express');
const { requireAuth, requireRole } = require('../middlewares/auth');
const dashboard = require('../controllers/dashboardController');

const router = express.Router();

router.use(require('./auth'));
router.get('/', requireAuth, dashboard.inicio);
router.use('/limpieza', requireAuth, require('./limpieza'));
router.use('/alimentacion', requireAuth, require('./alimentacion'));
router.use('/clinico', requireAuth, require('./clinico'));
router.use('/entradas', requireAuth, require('./entradas'));
router.use('/usuarios', requireAuth, requireRole('admin'), require('./usuarios'));

module.exports = router;
