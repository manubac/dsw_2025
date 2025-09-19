import { Entity, Property, OneToMany, Cascade, Collection } from "@mikro-orm/core";
import { Vendedor } from "./vendedores.entity.js"
import { BaseEntity } from "../shared/db/baseEntity.js"

@Entity()
export class VendedorClass extends BaseEntity {
    @Property({nullable:false, unique: true})
    name!:string

    @Property()
    description!:string

    @OneToMany(() => Vendedor, (vendedor) => vendedor.vendedorClass, {cascade: [Cascade.ALL]})
    vendedores = new Collection<Vendedor>(this)
}