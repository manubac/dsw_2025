import { Collection, Entity, ManyToMany, Property } from "@mikro-orm/core"
import { BaseEntity } from "../shared/db/baseEntity.js"
import { Vendedor } from "./vendedores.entity.js"

@Entity()
export class Item extends BaseEntity {
    @Property({nullable:false})
    name!:string

    @Property()
    description!:string

    @ManyToMany(() => Vendedor, (vendedor) => vendedor.items)
    vendedores = new Collection<Vendedor>(this)
}