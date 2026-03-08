import { Entity, PrimaryKey, Property } from "@mikro-orm/core";
import { BaseEntity } from "../shared/db/baseEntity.js";

@Entity()
export class User extends BaseEntity {
  @Property({ nullable: false, unique: true })
  username!: string;

  @Property({ nullable: false, unique: true })
  email!: string;

  @Property({ hidden: true, nullable: false })
  password!: string;

  @Property({ nullable: false, default: 'user' })
  role!: string;

  @Property({ hidden: true, nullable: true })
  resetPasswordToken?: string;

  @Property({ hidden: true, nullable: true })
  resetPasswordExpires?: Date;
}
