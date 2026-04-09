import { Entity, PrimaryKey, Property, OneToMany, Collection } from "@mikro-orm/core"
import { BaseEntity } from "../shared/db/baseEntity.js"
import { ItemCarta } from "../carta/itemCarta.entity.js"

@Entity()
export class Vendedor extends BaseEntity {
    @Property({nullable:false, unique: true})
    nombre!: string

    @Property({nullable:false, unique: true})
    email!: string

    @Property({hidden: true, nullable:false})
    password!: string

    @Property()
    telefono!: string

    @Property({ hidden: true, nullable: true })
    resetPasswordToken?: string;

    @Property({ hidden: true, nullable: true })
    resetPasswordExpires?: Date;

    //public rating: number,

    @OneToMany(() => ItemCarta, (itemCarta) => itemCarta.uploaderVendedor)
    itemCartas = new Collection<ItemCarta>(this)
}
     