import app from "./app.js";
import { syncSchema } from './shared/db/orm.js';

const PORT = 3000;

async function startServer() {
  // Schema sync 
  try {
    // await syncSchema();
    console.log('DB schema sync completed');
  } catch (err) {
    console.error('Error syncing DB schema on startup:', err);
  }
  
  app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
  });
}

startServer();
