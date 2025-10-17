import app from './app.js';
import { syncSchema } from './shared/db/orm.js';

const PORT = 3000;

async function startServer() {
  await syncSchema(); // sincroniza el esquema si es necesario
  app.listen(PORT, () => {
    console.log(`✅ Servidor corriendo en http://localhost:${PORT}`);
  });
}

startServer();
