const path = require('path');
const express = require('express');
const session = require('express-session');
const PgSession = require('connect-pg-simple')(session);
const helmet = require('helmet');
const { pool } = require('./config/db');
const { runMigrations } = require('./config/migrate');
const { ensureAdmin } = require('./config/bootstrap');
const { csrfProtection } = require('./middlewares/csrf');
const { exposeLocals } = require('./middlewares/locals');
const helpers = require('./utils/helpers');
const routes = require('./routes');

if (!process.env.SESSION_SECRET) {
  console.error('Falta la variable de entorno SESSION_SECRET. Revisa .env.example.');
  process.exit(1);
}

const app = express();
const enProduccion = process.env.NODE_ENV === 'production';

app.set('view engine', 'ejs');
// Arreglo para que EJS resuelva include('partials/...') desde cualquier subcarpeta.
app.set('views', [path.join(__dirname, '..', 'views')]);
app.set('trust proxy', 1); // Render atiende detrás de un proxy HTTPS.

app.use(helmet());
app.use(express.static(path.join(__dirname, '..', 'public')));
app.get('/healthz', (req, res) => res.send('ok'));
app.use(express.urlencoded({ extended: false, limit: '100kb' }));
app.use(session({
  store: new PgSession({ pool, tableName: 'sesiones', createTableIfMissing: true }),
  name: 'msid',
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: enProduccion,
    maxAge: 8 * 60 * 60 * 1000, // una jornada
  },
}));
app.use(exposeLocals);
app.use(csrfProtection);
app.use(routes);

app.use((req, res) => {
  res.status(404).render('error', { title: 'No encontrado', status: 404, mensaje: 'La página que buscas no existe.' });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const status = err.status || err.statusCode || 500;
  if (status >= 500) console.error(err);
  res.locals.h = res.locals.h || helpers;
  res.status(status).render('error', {
    title: status === 403 ? 'Acceso denegado' : 'Error',
    status,
    mensaje: status < 500 ? err.message : 'Ocurrió un error inesperado. Inténtalo de nuevo.',
  });
});

async function iniciar() {
  await runMigrations();
  await ensureAdmin();
  const puerto = Number(process.env.PORT) || 3000;
  app.listen(puerto, () => console.log(`Mirada Salvaje escuchando en el puerto ${puerto}`));
}

iniciar().catch((err) => {
  console.error('No se pudo iniciar la aplicación:', err.message);
  process.exit(1);
});
