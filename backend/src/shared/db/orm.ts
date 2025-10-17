import { MikroORM } from "@mikro-orm/mysql"
import { SqlHighlighter } from "@mikro-orm/sql-highlighter"

export const orm = await MikroORM.init({
    entities: ['./dist/**/*.entity.js'],
    entitiesTs: ['./src/**/*.entity.ts'],
    dbName: 'heroclash4geeks',
    /*type: 'mysql',*/
    clientUrl: 'mysql://dsw:dsw@localhost:3307/heroclash4geeks',
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
