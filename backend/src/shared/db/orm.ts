import { MikroORM } from "@mikro-orm/mysql"
import { SqlHighlighter } from "@mikro-orm/sql-highlighter"
import { Carta } from "../../carta/carta.entity.js"
import { CartaClass } from "../../carta/cartaClass.entity.js"
import { ItemCarta } from "../../carta/itemCarta.entity.js"
import { Compra } from "../../compra/compra.entity.js"
import { Vendedor } from "../../vendedor/vendedores.entity.js"
import { Item } from "../../vendedor/item.entity.js"
import { User } from "../../user/user.entity.js"
import { Direccion } from "../../direccion/direccion.entity.js"
import { Intermediario } from "../../intermediario/intermediario.entity.js"
import { Envio } from "../../envio/envio.entity.js"
import { Valoracion } from "../../valoracion/valoracion.entity.js"

export const orm = await MikroORM.init({
    entities: [Carta, CartaClass, ItemCarta, Compra, Vendedor, Item, User, Direccion, Intermediario, Envio, Valoracion],
    dbName: 'heroclash4geeks',
    /*type: 'mysql',*/
    clientUrl: 'mysql://dsw:dsw@localhost:3306/heroclash4geeks',
    highlighter: new SqlHighlighter(),
    debug: true,
    schemaGenerator: {
        disableForeignKeys: true,
        createForeignKeyConstraints: true,
        ignoreSchema: [],
    },
})

export const syncSchema = async () => {
    const generator = orm.getSchemaGenerator()
    /*
    await generator.dropSchema()  --- IGNORE ---
    await generator.createSchema()  --- IGNORE ---
    */ 
    await generator.updateSchema()
}
