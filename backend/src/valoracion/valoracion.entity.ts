import { Entity, Property, ManyToOne } from "@mikro-orm/core";
import { BaseEntity } from "../shared/db/baseEntity.js";
import { User } from "../user/user.entity.js";

@Entity()
export class Valoracion extends BaseEntity {
  @Property({ nullable: false })
  puntuacion!: number; // Rating from 1 to 5

  @Property({ nullable: true })
  comentario?: string;

  @ManyToOne(() => User, { nullable: false })
  usuario!: User; // User who gave the rating

  @Property({ nullable: false })
  tipoObjeto!: string; // 'vendedor', 'intermediario', or 'carta'

  @Property({ nullable: false })
  objetoId!: number; // ID of the rated object (vendedor, intermediario, or carta)
}