import app from "./app.js";
// ❌ Eliminamos el import de syncSchema
// import { syncSchema } from './shared/db/orm.js';

const PORT = 3000;

async function startServer() {
  // ❌ Quitamos la sincronización automática
  // await syncSchema(); 

  app.listen(PORT, () => {
    console.log(`✅ Servidor corriendo en http://localhost:${PORT}`);
  });
}

startServer();
