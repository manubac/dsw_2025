import { MikroORM } from "@mikro-orm/mysql"
import { SqlHighlighter } from "@mikro-orm/sql-highlighter"
import { Carta } from "../../carta/carta.entity.js"
import { CartaClass } from "../../carta/cartaClass.entity.js"
import { ItemCarta } from "../../carta/itemCarta.entity.js"
import { Vendedor } from "../../vendedor/vendedores.entity.js"
import { VendedorClass } from "../../vendedor/vendedorClass.entity.js"
import { Item } from "../../vendedor/item.entity.js"

export const orm = await MikroORM.init({
    entities: [Carta, CartaClass, ItemCarta, Vendedor, VendedorClass, Item],
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
