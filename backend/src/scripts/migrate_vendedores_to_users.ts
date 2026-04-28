import 'dotenv/config';
import 'reflect-metadata';
import { MikroORM } from '@mikro-orm/postgresql';
import { SqlHighlighter } from '@mikro-orm/sql-highlighter';
import { User } from '../user/user.entity.js';
import { Vendedor } from '../vendedor/vendedores.entity.js';
import { VerificationCode } from '../verification/verificationCode.entity.js';
import { Carta } from '../carta/carta.entity.js';
import { CartaClass } from '../carta/cartaClass.entity.js';
import { ItemCarta } from '../carta/itemCarta.entity.js';
import { Compra } from '../compra/compra.entity.js';
import { Direccion } from '../direccion/direccion.entity.js';
import { Intermediario } from '../intermediario/intermediario.entity.js';
import { Envio } from '../envio/envio.entity.js';
import { Valoracion } from '../valoracion/valoracion.entity.js';
import { StagePokemon } from '../stage/stage.entity.js';
import { Mensaje } from '../mensaje/mensaje.entity.js';
import { Wishlist } from '../wishlist/wishlist.entity.js';
import { TiendaRetiro } from '../tiendaRetiro/tiendaRetiro.entity.js';

const orm = await MikroORM.init({
  entities: [Carta, CartaClass, ItemCarta, Compra, Vendedor, User, Direccion, Intermediario, Envio, Valoracion, StagePokemon, Mensaje, Wishlist, TiendaRetiro, VerificationCode],
  clientUrl: process.env.DB_CONNECTION_STRING || 'postgresql://postgres:post1234@localhost:5432/heroclash_dsw',
  highlighter: new SqlHighlighter(),
  debug: false,
});

const em = orm.em.fork();

const vendedores = await em.find(Vendedor, { user: null });
console.log(`Migrando ${vendedores.length} vendedor(es) sin User asociado...`);

for (const v of vendedores) {
  const existingUser = await em.findOne(User, { email: v.email });

  if (existingUser) {
    console.log(`  [skip] ${v.email} — User ya existe (id=${existingUser.id}), vinculando.`);
    v.user = existingUser;
  } else {
    const newUser = em.create(User, {
      username: v.email,
      email: v.email,
      password: v.password,
      role: 'user',
      is_email_verified: true,
      is_phone_verified: false,
    });
    v.user = newUser;
    console.log(`  [create] User para ${v.email}`);
  }
}

await em.flush();
console.log('Migración completada.');
await orm.close();
