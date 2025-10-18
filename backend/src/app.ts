import "reflect-metadata";
import express from "express";
import cors from "cors";
import { RequestContext } from "@mikro-orm/core";
import { orm, syncSchema } from "./shared/db/orm.js";

// Routers
import { vendedorRouter } from "./vendedor/vendedor.routes.js";
import { vendedorClassRouter } from "./vendedor/vendedorClass.routes.js";
import { itemRouter } from "./vendedor/item.routes.js";
import { cartaRouter } from "./carta/carta.routes.js";
import { cartaClassRouter } from "./carta/cartaClass.routes.js";
import { itemCartaRouter } from "./carta/itemCarta.routes.js";

const app = express();

// ✅ Middlewares base
app.use(cors());
app.use(express.json());

// ✅ Contexto MikroORM
app.use((req, res, next) => {
  RequestContext.create(orm.em, next);
});

// ✅ Logs
app.use("/api/cartas", (req, res, next) => {
  console.log(`${req.method} ${req.path}`, req.body);
  next();
});

// ✅ Rutas principales
app.use("/api/vendedores/classes", vendedorClassRouter);
app.use("/api/vendedores", vendedorRouter);
app.use("/api/items", itemRouter);
app.use("/api/cartas/classes", cartaClassRouter);
app.use("/api/cartas", cartaRouter);
app.use("/api/itemsCarta", itemCartaRouter);

// ✅ 404 fallback
app.use((req, res) => {
  res.status(404).send({ message: "Ruta no encontrada" });
});

// ✅ Sincronizar esquema SOLO en desarrollo
if (process.env.NODE_ENV !== "production") {
  (async () => {
    try {
      await syncSchema();
      console.log("✅ Esquema de la base actualizado (dev).");
    } catch (err) {
      console.error("❌ Error al sincronizar esquema:", err);
    }
  })();
}

// ✅ Iniciar servidor
app.listen(3000, () => {
  console.log("✅ Server corriendo en: http://localhost:3000");
});

export default app;
