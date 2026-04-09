import { MikroORM } from "@mikro-orm/core";
import { User } from "../user/user.entity.js";
import { Vendedor } from "../vendedor/vendedores.entity.js";
import { Intermediario } from "../intermediario/intermediario.entity.js";
import bcrypt from 'bcryptjs';
import { orm } from "../shared/db/orm.js";

async function hashPasswords() {
  const em = orm.em.fork();

  try {
    const saltRounds = 10;
    
    // Hash Users
    const users = await em.find(User, {});
    console.log(`Found ${users.length} users. Checking for plain text passwords...`);
    let updatedUsers = 0;
    for (const user of users) {
      if (!user.password.startsWith('$2b$') && !user.password.startsWith('$2a$')) {
        console.log(`Hashing password for user: ${user.username}`);
        user.password = await bcrypt.hash(user.password, saltRounds);
        updatedUsers++;
      }
    }
    
    // Hash Vendedores
    const vendedores = await em.find(Vendedor, {});
     console.log(`Found ${vendedores.length} vendedores. Checking for plain text passwords...`);
     let updatedVendedores = 0;
     for (const v of vendedores) {
      if (!v.password.startsWith('$2b$') && !v.password.startsWith('$2a$')) {
        console.log(`Hashing password for vendedor: ${v.nombre}`);
        v.password = await bcrypt.hash(v.password, saltRounds);
        updatedVendedores++;
      }
     }
     
    // Hash Intermediarios
    const intermediarios = await em.find(Intermediario, {});
     console.log(`Found ${intermediarios.length} intermediarios. Checking for plain text passwords...`);
     let updatedIntermediarios = 0;
     for (const i of intermediarios) {
      if (!i.password.startsWith('$2b$') && !i.password.startsWith('$2a$')) {
        console.log(`Hashing password for intermediario: ${i.nombre}`);
        i.password = await bcrypt.hash(i.password, saltRounds);
        updatedIntermediarios++;
      }
     }

    if (updatedUsers > 0 || updatedVendedores > 0 || updatedIntermediarios > 0) {
      await em.flush();
      console.log(`Successfully hashed: ${updatedUsers} users, ${updatedVendedores} vendedores, ${updatedIntermediarios} intermediarios.`);
    } else {
      console.log("No plain text passwords found in any entity.");
    }

  } catch (error) {
    console.error("Error hashing passwords:", error);
  } finally {
    await orm.close();
  }
}

hashPasswords();
