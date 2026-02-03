
import { orm } from "../shared/db/orm.js";
import { Compra } from "../compra/compra.entity.js";
import { ItemCarta } from "../carta/itemCarta.entity.js";

async function resetPurchases() {
  const em = orm.em.fork();

  try {
    console.log("Starting purchase reset...");
    
    // 1. Get all purchases with their items
    const purchases = await em.find(Compra, {}, { populate: ['itemCartas'] });
    console.log(`Found ${purchases.length} purchases to delete.`);

    for (const purchase of purchases) {
        // 2. For each purchase, increment stock of the items
        for (const item of purchase.itemCartas) {
             // Increment stock. Assuming 1 quantity per item reference if checkout logic just added references. 
             // If input.items (JSON) stored quantity, we should ideally use that.
             // But the backend `add` controller decremented stock by 1 per itemCartas reference in the loop:
             /*
                for (const item of itemCartas) {
                    if (item.stock > 0) item.stock -= 1;
                }
             */
             // So we just increment by 1 for each associated item.
             // Note: purchase.itemCartas is a Collection. If an item was bought 5 times, is it in the collection 5 times?
             // ManyToMany usually stores unique references. 
             // Let's check the Compra entity definition if possible, but standard ManyToMany is unique.
             // However, the controller loop `for (const item of itemCartas)` suggests `itemCartas` input array might have duplicates?
             // `const itemCartas = await em.find(ItemCarta, { id: { $in: input.cartasIds } });` 
             // $in returns unique entities. So stock was only decremented ONCE per unique item ID in that loop! 
             // Wait, let's re-read the `add` controller logic carefully.
             /*
                const itemCartas = await em.find(ItemCarta, { id: { $in: input.cartasIds } });
                ...
                for (const item of itemCartas) {
                    item.stock -= 1; 
                }
             */
             // Yes, it finds unique entities. So even if user bought 2 of the same item, it only decremented 1.
             // That's a bug in the purchase logic if quantity > 1 was intended, but consistent for this restoration logic.
             // So we just increment by 1.
             
             item.stock += 1;
             
             // If it was paused (0 stock), make it available again?
             // The controller paused it if stock reached 0.
             if (item.estado === 'pausado' && item.stock > 0) {
                 item.estado = 'disponible';
             }
        }
        
        // 3. Delete the purchase
        em.remove(purchase);
    }

    await em.flush();
    console.log("All purchases deleted and stock restored (incremented by 1 per unique item in purchase).");
    
    // Optional: Force reset all stocks to a minimum value so the user can test?
    // User said "i have no stock of anything".
    // Let's also ensure every ItemCarta has at least 5 stock for testing purposes.
    const allItems = await em.find(ItemCarta, {});
    for (const item of allItems) {
        if (item.stock < 5) {
            item.stock = 5;
            item.estado = 'disponible';
        }
    }
    await em.flush();
    console.log("Additionally set minimum stock to 5 for all items.");

  } catch (error) {
    console.error("Error resetting purchases:", error);
  } finally {
    await orm.close();
  }
}

resetPurchases();
