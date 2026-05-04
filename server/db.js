const { Pool } = require('pg');

// DATABASE_URL é injetada automaticamente pelo Railway ao adicionar o plugin PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

/**
 * Executa uma query no banco de dados.
 * @param {string} sql
 * @param {any[]} [params]
 */
async function query(sql, params) {
  const client = await pool.connect();
  try {
    return await client.query(sql, params);
  } finally {
    client.release();
  }
}

/**
 * Cria as tabelas necessárias se ainda não existirem.
 * Chamado uma vez no startup do servidor.
 */
async function initDb() {
  await query(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id         TEXT PRIMARY KEY,
      nome       TEXT NOT NULL,
      email      TEXT UNIQUE NOT NULL,
      senha_hash TEXT NOT NULL,
      criado_em  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS propostas (
      id               TEXT PRIMARY KEY,
      numero_seq       INTEGER NOT NULL,
      status           TEXT NOT NULL DEFAULT 'pendente',
      criado_em        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      atualizado_em    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      ppt_path         TEXT,
      ppt_gerado_em    TIMESTAMPTZ,
      criado_por_id    TEXT NOT NULL,
      criado_por_nome  TEXT NOT NULL,
      criado_por_email TEXT NOT NULL,
      proposal_json    JSONB NOT NULL,
      items_json       JSONB NOT NULL DEFAULT '[]'
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS config (
      chave TEXT PRIMARY KEY,
      valor TEXT NOT NULL
    )
  `);

  // Inicializa o contador de propostas (só insere se ainda não existir)
  await query(`
    INSERT INTO config (chave, valor) VALUES ('ultimo_numero', '0')
    ON CONFLICT (chave) DO NOTHING
  `);

  console.log('[db] Tabelas inicializadas com sucesso');
}

module.exports = { query, initDb };
