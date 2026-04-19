import 'dotenv/config'
import { MikroORM } from "@mikro-orm/postgresql"
import { SqlHighlighter } from "@mikro-orm/sql-highlighter"
import { Carta } from "../../carta/carta.entity.js"
import { CartaClass } from "../../carta/cartaClass.entity.js"
import { ItemCarta } from "../../carta/itemCarta.entity.js"
import { Compra } from "../../compra/compra.entity.js"
import { Vendedor } from "../../vendedor/vendedores.entity.js"
import { User } from "../../user/user.entity.js"
import { Direccion } from "../../direccion/direccion.entity.js"
import { Intermediario } from "../../intermediario/intermediario.entity.js"
import { Envio } from "../../envio/envio.entity.js"
import { Valoracion } from "../../valoracion/valoracion.entity.js"
import { StagePokemon } from "../../stage/stage.entity.js"
import { Mensaje } from "../../mensaje/mensaje.entity.js"

export const orm = await MikroORM.init({
    entities: [Carta, CartaClass, ItemCarta, Compra, Vendedor, User, Direccion, Intermediario, Envio, Valoracion, StagePokemon, Mensaje],
    dbName: process.env.DB_NAME || 'heroclash_dsw',
    clientUrl: process.env.DB_CONNECTION_STRING || 'postgresql://postgres:post1234@localhost:5432/heroclash_dsw',
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
    await generator.updateSchema()
}
