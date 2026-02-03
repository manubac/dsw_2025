import { Entity, PrimaryKey, Property } from "@mikro-orm/core";
import { BaseEntity } from "../shared/db/baseEntity.js";

@Entity()
export class User extends BaseEntity {
  @Property({ nullable: false, unique: true })
  username!: string;

  @Property({ nullable: false, unique: true })
  email!: string;

  @Property({ nullable: false })
  password!: string;

  @Property({ nullable: false, default: 'user' })
  role!: string;

  @Property({ nullable: true })
  direcciones = []; 

  @Property({ nullable: true })
  resetPasswordToken?: string;

  @Property({ nullable: true })
  resetPasswordExpires?: Date;
}
