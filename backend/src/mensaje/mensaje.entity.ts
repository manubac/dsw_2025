import { Entity, Property, ManyToOne } from "@mikro-orm/core";
import { BaseEntity } from "../shared/db/baseEntity.js";
import { Compra } from "../compra/compra.entity.js";

@Entity()
export class Mensaje extends BaseEntity {
  @ManyToOne(() => Compra)
  compra!: Compra;

  @Property({ type: 'number' })
  senderId!: number;

  @Property({ type: 'string' })
  senderRole!: string;

  @Property({ type: 'string' })
  senderNombre!: string;

  @Property({ type: 'text' })
  texto!: string;
}
