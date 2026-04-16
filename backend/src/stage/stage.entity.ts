import { Entity, Property } from "@mikro-orm/core";
import { BaseEntity } from "../shared/db/baseEntity.js";

@Entity()
export class StagePokemon extends BaseEntity {
  @Property({ type: 'string' })
  lang!: string;         // "en", "es", "jp", "fr", "de", "it", "pt", "kr", "zh-hant", "zh-hans", "th"

  @Property({ type: 'string' })
  stageKey!: string;     // "basic", "stage1", "stage2", "restored", "special"

  @Property({ type: 'string' })
  value!: string;        // "Basic", "Stage 1", "Básico", "VMAX", "ex" ...

  @Property({ type: 'boolean', default: false })
  isSpecial!: boolean;   // true para VMAX, VSTAR, ex, GX, etc.
}
