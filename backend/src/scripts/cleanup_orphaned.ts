
import { orm } from "../shared/db/orm.js";
import { ItemCarta } from "../carta/itemCarta.entity.js";
import { Carta } from "../carta/carta.entity.js";

async function cleanup() {
  const em = orm.em.fork();

  try {
    // 1. Delete ItemCarta where uploaderVendedor is null
    const orphanedItems = await em.find(ItemCarta, { uploaderVendedor: null });
    console.log(`Found ${orphanedItems.length} orphaned ItemCartas.`);
    
    if (orphanedItems.length > 0) {
      for (const item of orphanedItems) {
        console.log(`Deleting ItemCarta ID: ${item.id}, Name: ${item.name}`);
        em.remove(item);
      }
      await em.flush();
      console.log('Deleted orphaned ItemCartas.');
    }

    // 2. Delete Carta where uploader is null AND it has no items (to be safe, or just check uploader)
    // The user said "old card (with no uploader)". 
    // If a Carta has no uploader, it's likely an "old" one defined system-wide or mistakenly created?
    // Let's filter by uploader: null
    
    const orphanedCartas = await em.find(Carta, { uploader: null });
    console.log(`Found ${orphanedCartas.length} orphaned Cartas (no uploader).`);

    if (orphanedCartas.length > 0) {
       for (const carta of orphanedCartas) {
           console.log(`Deleting Carta ID: ${carta.id}, Name: ${carta.name}`);
           em.remove(carta);
       }
       await em.flush();
       console.log('Deleted orphaned Cartas.');
    }

  } catch (error) {
    console.error('Error during cleanup:', error);
  } finally {
    await orm.close();
  }
}

cleanup();
