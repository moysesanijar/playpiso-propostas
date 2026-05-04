const { Router } = require('express');
const { existsSync } = require('fs');
const { spawn } = require('child_process');
const path = require('path');
const { verifyToken } = require('../middleware/auth');
const db = require('../db');

const PROJECT_ROOT = path.join(__dirname, '../..');

// Use venv Python if available, otherwise fall back to system python3
const VENV_PYTHON = path.join(PROJECT_ROOT, 'venv', 'bin', 'python3');
const PYTHON = existsSync(VENV_PYTHON) ? VENV_PYTHON : 'python3';

console.log(`[gerar.js] Python: ${PYTHON}`);

const WRAPPER_SCRIPT = path.join(PROJECT_ROOT, 'services', 'generate_wrapper.py');
const TIMEOUT_MS = 300_000; // 5 minutos — template de 71MB pode demorar

const router = Router();

// POST /api/gerar-proposta
router.post('/gerar-proposta', verifyToken, async (req, res) => {
  const { proposta_id } = req.body;

  if (!proposta_id) {
    return res.status(400).json({ ok: false, error: 'proposta_id é obrigatório' });
  }

  let proposta;
  try {
    const result = await db.query('SELECT * FROM propostas WHERE id = $1', [proposta_id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ ok: false, error: 'Proposta não encontrada' });
    }
    const row = result.rows[0];
    proposta = {
      proposal: row.proposal_json,
      items: row.items_json,
    };
  } catch (err) {
    console.error('[gerar.js] Erro ao ler proposta:', err);
    return res.status(500).json({ ok: false, error: 'Erro ao ler banco de dados' });
  }

  const payload = JSON.stringify(proposta);

  const child = spawn(PYTHON, [WRAPPER_SCRIPT], {
    cwd: PROJECT_ROOT,
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, PYTHONUNBUFFERED: '1' },
  });

  let stdout = '';
  let stderr = '';

  child.stdout.on('data', chunk => { stdout += chunk.toString(); });
  child.stderr.on('data', chunk => {
    const text = chunk.toString();
    stderr += text;
    process.stderr.write(`[Python] ${text}`);
  });

  // Send payload and close stdin so Python's sys.stdin.read() unblocks
  child.stdin.write(payload, 'utf8');
  child.stdin.end();

  // Timeout guard
  const timer = setTimeout(() => {
    child.kill('SIGTERM');
    if (!res.headersSent) {
      res.status(500).json({
        ok: false,
        error: `Timeout (${TIMEOUT_MS / 1000}s) ao gerar proposta. Erro Python:\n${stderr.slice(-500) || '(sem output)'}`,
      });
    }
  }, TIMEOUT_MS);

  child.on('close', async (code) => {
    clearTimeout(timer);
    if (res.headersSent) return;

    console.log(`[gerar.js] Python exit code: ${code}`);
    if (stderr) console.error(`[gerar.js] Python stderr:\n${stderr}`);

    let result;
    try {
      result = JSON.parse(stdout.trim());
    } catch {
      const detail = stderr.slice(-800) || stdout || `Código de saída: ${code}`;
      return res.status(500).json({ ok: false, error: `Erro no serviço Python:\n${detail}` });
    }

    if (!result.ok) {
      return res.status(500).json({ ok: false, error: result.error });
    }

    // Update ppt_path in database
    try {
      await db.query(
        `UPDATE propostas SET ppt_path = $1, ppt_gerado_em = $2, atualizado_em = $3 WHERE id = $4`,
        [result.ppt_path, new Date().toISOString(), new Date().toISOString(), proposta_id]
      );
    } catch (e) {
      console.error('[gerar.js] Erro ao salvar ppt_path:', e);
    }

    const relativePath = result.ppt_path.replace(PROJECT_ROOT, '').replace(/\\/g, '/');
    const download_url = relativePath.startsWith('/') ? relativePath : `/${relativePath}`;

    res.json({ ok: true, download_url, ppt_path: result.ppt_path });
  });

  child.on('error', (err) => {
    clearTimeout(timer);
    console.error('[gerar.js] Falha ao iniciar Python:', err);
    if (!res.headersSent) {
      res.status(500).json({ ok: false, error: `Falha ao iniciar Python: ${err.message}` });
    }
  });
});

module.exports = router;
