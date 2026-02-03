import { orm } from "../shared/db/orm.js";
import { Compra } from "../compra/compra.entity.js";

async function deletePurchases() {
  const em = orm.em.fork();

  try {
    console.log("Deleting all purchases...");
    await em.nativeDelete(Compra, {});
    console.log("Purchases deleted successfully.");
  } catch (error) {
    console.error("Error deleting purchases:", error);
  } finally {
    try {
      await orm.close();
    } catch(e) { /* ignore */ }
    process.exit(0);
  }
}

deletePurchases();
