import { Entity, PrimaryKey, Property, OneToMany, Collection, Cascade, ManyToMany, OneToOne, Rel } from "@mikro-orm/core";
import { BaseEntity } from "../shared/db/baseEntity.js";
import { Direccion } from "../direccion/direccion.entity.js";
import { ItemCarta } from "../carta/itemCarta.entity.js";

@Entity()
export class Intermediario extends BaseEntity {
    @Property({ nullable: false, unique: true })
    nombre!: string;

    @Property({ nullable: false, unique: true })
    email!: string;

    @Property({ nullable: false })
    password!: string;

    @Property({ nullable: false })
    telefono!: string;

    @Property({ nullable: true })
    resetPasswordToken?: string;

    @Property({ nullable: true })
    resetPasswordExpires?: Date;

    @Property({ nullable: true })
    descripcion?: string;

    @Property({ default: true })
    activo!: boolean;

    // Dirección única de recogida/entrega
    @OneToOne(() => Direccion, { nullable: true, cascade: [Cascade.PERSIST, Cascade.REMOVE] })
    direccion?: Rel<Direccion>;

    @ManyToMany({ entity: () => ItemCarta, mappedBy: 'intermediarios' })
    itemCartas = new Collection<ItemCarta>(this);
}