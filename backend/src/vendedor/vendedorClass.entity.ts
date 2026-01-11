import { Entity, Property } from "@mikro-orm/core";
import { BaseEntity } from "../shared/db/baseEntity.js"

@Entity()
export class VendedorClass extends BaseEntity {
    @Property({nullable:false, unique: true})
    name!:string

    @Property()
    description!:string
}