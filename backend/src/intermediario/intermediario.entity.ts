import { Entity, PrimaryKey, Property, OneToMany, Collection, Cascade } from "@mikro-orm/core";
import { BaseEntity } from "../shared/db/baseEntity.js";
import { Direccion } from "../direccion/direccion.entity.js";

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
    descripcion?: string;

    @Property({ default: true })
    activo!: boolean;

    // Direcciones de recogida/entrega
    @OneToMany(() => Direccion, (direccion) => direccion.intermediario, { cascade: [Cascade.PERSIST, Cascade.REMOVE] })
    direcciones = new Collection<Direccion>(this);
}