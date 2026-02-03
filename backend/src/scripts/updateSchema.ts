import { orm } from "../shared/db/orm.js";

async function updateSchema() {
  try {
    const generator = orm.getSchemaGenerator();
    await generator.updateSchema();
    console.log("Schema updated successfully");
  } catch (error) {
    console.error("Error updating schema:", error);
  } finally {
    try {
      await orm.close();
    } catch (e) { /* ignore */ }
    process.exit(0);
  }
}

updateSchema();
