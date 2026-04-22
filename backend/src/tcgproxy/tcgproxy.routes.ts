// Proxy para apitcg.com — evita restricciones CORS del navegador
import { Router } from 'express';
import axios from 'axios';

export const tcgProxyRouter = Router();

const APITCG_BASE = 'https://apitcg.com/api';

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
