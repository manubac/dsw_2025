import { Entity, Property, ManyToOne, OneToMany, Rel, Enum } from "@mikro-orm/core";
import { BaseEntity } from "../shared/db/baseEntity.js";
import { Intermediario } from "../intermediario/intermediario.entity.js";
import { Compra } from "../compra/compra.entity.js";

export enum EstadoEnvio {
  PLANIFICADO = 'planificado',
  ACTIVO = 'activo',
  ORDEN_GENERADA = 'orden_generada',
  VENDEDOR_ENVIO = 'vendedor_envio',
  INTERMEDIARIO_RECIBIO = 'intermediario_recibio',
  INTERMEDIARIO_ENVIADO = 'intermediario_enviado',
  ENTREGADO = 'entregado',
  RETIRADO = 'retirado',
  CANCELADO = 'cancelado'
}

@Entity()
export class Envio extends BaseEntity {
    @Enum(() => EstadoEnvio)
    estado!: EstadoEnvio;

    @Property({ type: 'datetime', nullable: true })
    fechaEnvio?: Date;

    @Property({ type: 'datetime', nullable: true })
    fechaEntrega?: Date;

    @Property({ type: 'string', nullable: true })
    notas?: string;

    @ManyToOne(() => Intermediario, { nullable: false })
    intermediario!: Rel<Intermediario>;

    @ManyToOne(() => Intermediario, { nullable: true })
    destinoIntermediario?: Rel<Intermediario>;

    @Property({ type: 'number', nullable: true })
    minimoCompras?: number;

    @Property({ type: 'number', nullable: true })
    precioPorCompra?: number;

    @OneToMany(() => Compra, compra => compra.envio)
    compras: Rel<Compra>[] = [];
}
