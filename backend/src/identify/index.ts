// identify/index.ts
// Responsabilidad: punto de entrada del módulo de identificación.
// Re-exporta el router para que app.ts lo monte con una sola línea de import.
//
// Uso en app.ts:
//   import { identifyRouter } from './identify/index.js';
//   app.use('/api/identify', identifyRouter);

export { identifyRouter } from './routes/identify.js';
