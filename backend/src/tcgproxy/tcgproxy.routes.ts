// Proxy para apitcg.com — evita restricciones CORS del navegador
import { Router } from 'express';
import axios from 'axios';
import pg from 'pg';

export const tcgProxyRouter = Router();

const APITCG_BASE = 'https://apitcg.com/api';

const dbPool = new pg.Pool({
  connectionString: process.env.DB_CONNECTION_STRING ?? 'postgresql://postgres:post1234@localhost:5432/heroclash_dsw',
});

async function proxyGame(game: string, req: any, res: any): Promise<void> {
  const key = process.env.APITCG_KEY ?? '';
  try {
    const response = await axios.get(`${APITCG_BASE}/${game}/cards`, {
      params: req.query,
      headers: { 'x-api-key': key },
      timeout: 10000,
    });
    res.json(response.data);
  } catch (err: any) {
    if (err.response) {
      res.status(err.response.status).json(err.response.data);
    } else {
      res.status(500).json({ error: err.message ?? 'Error al contactar apitcg.com' });
    }
  }
}

tcgProxyRouter.get('/digimon',   (req, res) => proxyGame('digimon',   req, res));
tcgProxyRouter.get('/riftbound', (req, res) => proxyGame('riftbound', req, res));

// Devuelve el mapeo sigla TCG Live → ID de TCGdex desde la tabla pokemon_sets
tcgProxyRouter.get('/pokemon/sets', async (_req, res) => {
  try {
    const result = await dbPool.query<{ id: string; abbr: string; name_en: string }>(
      'SELECT id, abbr, name_en FROM pokemon_sets ORDER BY abbr'
    );
    res.json(result.rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message ?? 'DB error' });
  }
});
