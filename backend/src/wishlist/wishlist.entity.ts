import { Entity, Property, ManyToOne, Rel } from "@mikro-orm/core";
import { BaseEntity } from "../shared/db/baseEntity.js";
import { Carta } from "../carta/carta.entity.js";

@Entity()
export class Wishlist extends BaseEntity {
  @Property({ type: 'number' })
  userId!: number;

  @ManyToOne(() => Carta, { nullable: true })
  carta?: Rel<Carta>;

  @Property({ type: 'string', nullable: true })
  idioma?: string; // 'es' | 'en' | 'jp' | 'fr' | null = cualquiera

  @Property({ type: 'string', nullable: true })
  ciudad?: string; // 'rosario' | 'buenos_aires' | null = cualquiera

  @Property({ type: 'boolean', default: true })
  notificar: boolean = true;

  @Property({ type: 'decimal', nullable: true, precision: 10, scale: 2 })
  precioMax?: number;

  @Property({ type: 'datetime', nullable: true })
  ultimaNotificacion?: Date;
}
