import { syncSchema, orm } from "../shared/db/orm.js";

async function main() {
    try {
        console.log("Updating schema...");
        // Force update image column to LONGTEXT
        await orm.em.execute("ALTER TABLE carta MODIFY COLUMN image LONGTEXT");
        console.log("Forced LONGTEXT on carta.image");
        
        await syncSchema();
        console.log("Schema updated successfully.");
    } catch (e) {
        console.error("Error updating schema:", e);
    } finally {
        await orm.close();
    }
}
main();