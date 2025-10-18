import { Entity, PrimaryKey, Property, OneToMany,ManyToMany,Collection, ManyToOne, Cascade, Rel } from "@mikro-orm/core"
import { BaseEntity } from "../shared/db/baseEntity.js"
import { VendedorClass } from "./vendedorClass.entity.js"
import { Item } from "./item.entity.js"

@Entity()
export class Vendedor extends BaseEntity {
    @Property({nullable:false, unique: true})
    nombre!: string

    @ManyToOne (() => VendedorClass, {nullable: false})
    vendedorClass!: Rel<VendedorClass>

    @Property({nullable:false, unique: true})
    email!: string

    @Property()
    telefono!: string

    //public rating: number,

    @ManyToMany(() => Item, (item) => item.vendedores, {cascade:[Cascade.ALL], owner: true})
    items!: Item[]
}
     