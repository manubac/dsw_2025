import { Entity, Property, OneToMany, Cascade, Collection } from '@mikro-orm/core'
import { Carta } from './carta.entity.js'
import { BaseEntity } from '../shared/db/baseEntity.js'

@Entity()
export class CartaClass extends BaseEntity {

    @Property({ nullable: false, unique: true })
    name!: string

    @Property({ nullable: false })
    description!: string

    @OneToMany(() => Carta, carta => carta.cartaClass, {cascade: [Cascade.ALL]})
    carta = new Collection<Carta>(this); 

}