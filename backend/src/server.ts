import { createServer } from 'http';
import app from './app.js';
import { initSocket } from './socket/index.js';

const PORT = 3000;

async function startServer() {
  try {
    console.log('DB schema sync completed');
  } catch (err) {
    console.error('Error syncing DB schema on startup:', err);
  }

  const httpServer = createServer(app);
  initSocket(httpServer);

  httpServer.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
  });
}

startServer();
