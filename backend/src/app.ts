import "reflect-metadata";
import express from "express";
import cors from "cors";
import { RequestContext } from "@mikro-orm/core";
import { orm , syncSchema } from "./shared/db/orm.js"; 
import 'dotenv/config';

// Routers
import { vendedorRouter } from "./vendedor/vendedor.routes.js";
import { cartaRouter } from "./carta/carta.routes.js";
import { cartaClassRouter } from "./carta/cartaClass.routes.js";
import { itemCartaRouter } from "./carta/itemCarta.routes.js";
import { userRouter } from "./user/user.routes.js";
import { compraRouter } from "./compra/compra.routes.js";
import { contactRouter } from "./contact/contact.routes.js";
import { direccionRouter } from "./direccion/direccion.routes.js";
import { intermediarioRouter } from "./intermediario/intermediario.routes.js";
import envioRouter from "./envio/envio.router.js";
import valoracionRouter from "./valoracion/valoracion.routes.js";
import scanRouter from "./scan/scan.routes.js";
const app = express();

//  Middlewares base
app.use('/uploads', express.static('uploads'));
app.use(cors());
// Increase payload limit to handle large base64 images
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

//  Contexto MikroORM (asegura un EntityManager por request)
app.use((req, res, next) => {
  RequestContext.create(orm.em, next);
});

//  Logs de requests (solo para cartas)
app.use("/api/cartas", (req, res, next) => {
  console.log(`${req.method} ${req.path}`, req.body);
  next();
}); //lo pusimos para ver en consola las cartas que subiamos, para debugging

//  Rutas principales
app.use("/api/vendedores", vendedorRouter);
app.use("/api/cartas/classes", cartaClassRouter);
app.use("/api/cartas", cartaRouter);
app.use("/api/itemsCarta", itemCartaRouter);
app.use("/api/users", userRouter); // nueva ruta para usuarios
app.use("/api/compras", compraRouter);
app.use("/api/contact", contactRouter);
app.use("/api/direcciones", direccionRouter);
app.use("/api/intermediarios", intermediarioRouter);
app.use("/api/envios", envioRouter);
app.use("/api/valoraciones", valoracionRouter);
app.use("/api/scan", scanRouter);
// identifyRouter se carga dinámicamente para que un fallo de opencv no tire el servidor.
// El slot debe registrarse ANTES del 404 handler; el handler interno se swapea cuando el
// módulo termina de cargar.
let identifyHandler: express.RequestHandler = (_req, res) => {
  res.status(503).json({ success: false, mensaje: "Módulo de identificación cargando, reintentá en unos segundos." });
};
app.use("/api/identify", (req, res, next) => identifyHandler(req, res, next));

import("./identify/index.js")
  .then(({ identifyRouter }) => {
    identifyHandler = identifyRouter as unknown as express.RequestHandler;
    console.log("[identify] módulo cargado y listo.");
  })
  .catch((err) => {
    console.warn("[identify] módulo no disponible:", err.message);
    identifyHandler = (_req, res) =>
      res.status(503).json({ success: false, mensaje: "Módulo de identificación no disponible.", debug: { error: err.message } });
  });

//  404 fallback
app.use((req, res) => {
  res.status(404).send({ message: "Ruta no encontrada" });
});


//  Sincronizar esquema SOLO en desarrollo
if (process.env.NODE_ENV !== "production") {
  (async () => {
    try {
      await syncSchema();
      console.log("Esquema de la base actualizado (dev).");
    } catch (err) {
      console.error("Error al sincronizar esquema:", err);
    }
  })();
}  



export default app;

