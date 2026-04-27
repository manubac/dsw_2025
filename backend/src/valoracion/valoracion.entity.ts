import { Entity, Property, ManyToOne } from "@mikro-orm/core";
import { BaseEntity } from "../shared/db/baseEntity.js";
import { User } from "../user/user.entity.js";
import { Vendedor } from "../vendedor/vendedores.entity.js";
import { Compra } from "../compra/compra.entity.js";

@Entity()
export class Valoracion extends BaseEntity {
  @Property({ type: 'number', nullable: false })
  puntuacion!: number;

  @Property({ type: 'string', nullable: true })
  comentario?: string;

  @ManyToOne(() => User, { nullable: true })
  usuario?: User;

  @ManyToOne(() => Vendedor, { nullable: true })
  vendedor?: Vendedor;

  @ManyToOne(() => Compra, { nullable: true })
  compra?: Compra;

  @Property({ type: 'string', nullable: false })
  tipoObjeto!: string;

  @Property({ type: 'number', nullable: false })
  objetoId!: number;
}
