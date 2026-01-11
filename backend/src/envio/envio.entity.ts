import { Entity, Property, ManyToOne, OneToMany, Rel, Enum } from "@mikro-orm/core";
import { BaseEntity } from "../shared/db/baseEntity.js";
import { Intermediario } from "../intermediario/intermediario.entity.js";
import { Compra } from "../compra/compra.entity.js";

export enum EstadoEnvio {
  ORDEN_GENERADA = 'orden_generada',
  VENDEDOR_ENVIO = 'vendedor_envio',
  INTERMEDIARIO_RECIBIO = 'intermediario_recibio',
  RETIRADO = 'retirado'
}

@Entity()
export class Envio extends BaseEntity {
    @Enum(() => EstadoEnvio)
    estado!: EstadoEnvio;

    @Property({ nullable: true })
    fechaEnvio?: Date;

    @Property({ nullable: true })
    fechaEntrega?: Date;

    @Property({ nullable: true })
    notas?: string;

    @ManyToOne(() => Intermediario, { nullable: false })
    intermediario!: Rel<Intermediario>;

    @OneToMany(() => Compra, compra => compra.envio)
    compras!: Rel<Compra>[];
}