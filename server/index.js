const express = require('express');
const path = require('path');
const propostasRouter = require('./routes/propostas');
const gerarRouter = require('./routes/gerar');
const authRouter = require('./routes/auth');
const db = require('./db');

const PROJECT_ROOT = path.join(__dirname, '..');
const isProduction = process.env.NODE_ENV === 'production';

const app = express();
const PORT = process.env.PORT || 3000;

app.disable('etag');
app.use(express.json({ limit: '2mb' }));

if (!isProduction) {
  app.use((req, res, next) => {
    if (/\.(html|js|css|json)$/.test(req.path) || req.path === '/') {
      res.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    }
    next();
  });
}

app.use(express.static(PROJECT_ROOT, { etag: false, lastModified: false }));
app.use('/outputs', express.static(path.join(PROJECT_ROOT, 'outputs')));

app.use('/api/auth', authRouter);
app.use('/api/propostas', propostasRouter);
app.use('/api', gerarRouter);

app.get('/{*path}', (req, res) => {
  res.sendFile(path.join(PROJECT_ROOT, 'index.html'));
});

// Inicializa o banco de dados antes de aceitar conexões
db.initDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`PlayPiso Propostas rodando em http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('[FATAL] Falha ao inicializar banco de dados:', err.message);
    console.error('Verifique se a variável DATABASE_URL está configurada corretamente.');
    process.exit(1);
  });
