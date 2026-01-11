import { Entity, PrimaryKey, Property, OneToMany,ManyToMany,Collection, Cascade } from "@mikro-orm/core"
import { BaseEntity } from "../shared/db/baseEntity.js"
import { Item } from "./item.entity.js"

@Entity()
export class Vendedor extends BaseEntity {
    @Property({nullable:false, unique: true})
    nombre!: string

    @Property({nullable:false, unique: true})
    email!: string

    @Property({nullable:false})
    password!: string

    @Property()
    telefono!: string

    //public rating: number,

    @ManyToMany(() => Item, (item) => item.vendedores, {cascade:[Cascade.ALL], owner: true})
    items!: Item[]
}
     