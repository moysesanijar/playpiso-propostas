const express = require('express');
const path = require('path');
const fs = require('fs');
const propostasRouter = require('./routes/propostas');
const gerarRouter = require('./routes/gerar');
const authRouter = require('./routes/auth');

const PROJECT_ROOT = path.join(__dirname, '..');
const isProduction = process.env.NODE_ENV === 'production';

// Garante que arquivos de dados existem (Railway volume começa vazio)
const DATA_DIR = path.join(__dirname, 'data');
const OUTPUTS_DIR = path.join(PROJECT_ROOT, 'outputs', 'propostas');
fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(OUTPUTS_DIR, { recursive: true });

const USUARIOS_FILE = path.join(DATA_DIR, 'usuarios.json');
const ORCAMENTOS_FILE = path.join(DATA_DIR, 'orcamentos.json');
if (!fs.existsSync(USUARIOS_FILE)) {
  fs.writeFileSync(USUARIOS_FILE, JSON.stringify({ usuarios: [] }, null, 2));
}
if (!fs.existsSync(ORCAMENTOS_FILE)) {
  fs.writeFileSync(ORCAMENTOS_FILE, JSON.stringify({ ultimo_numero: 0, propostas: [] }, null, 2));
}

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

app.listen(PORT, () => {
  console.log(`PlayPiso Propostas rodando em http://localhost:${PORT}`);
});
