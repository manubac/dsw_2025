import 'reflect-metadata';
import 'dotenv/config'; // 🔹 Importante para leer .env
import express from 'express';
import { RequestContext } from '@mikro-orm/core';
import { orm, syncSchema } from './shared/db/orm.js';

import { vendedorRouter } from './vendedor/vendedor.routes.js';
import { cartaRouter } from './carta/carta.routes.js';
import { vendedorClassRouter } from './vendedor/vendedorClass.routes.js';
import { itemRouter } from './vendedor/item.routes.js';
import { cartaClassRouter } from './carta/cartaClass.routes.js';
import { itemCartaRouter } from './carta/itemCarta.routes.js';

const app = express();
app.use(express.json());

// RequestContext para MikroORM
app.use((req, res, next) => {
  RequestContext.create(orm.em, next);
});

// Rutas
app.use('/api/vendedores/classes', vendedorClassRouter);
app.use('/api/vendedores', vendedorRouter);
app.use('/api/items', itemRouter);
app.use('/api/cartas/classes', cartaClassRouter);
app.use('/api/cartas', cartaRouter);
app.use('/api/itemsCarta', itemCartaRouter);

// Ruta no encontrada
app.use((req, res) => {
  res.status(404).send({ message: 'Ruta no encontrada' });
});

// Sincronizar esquema
await syncSchema();

// Iniciar servidor
app.listen(3000, () => {
  console.log('Server is running on http://localhost:3000');
});
