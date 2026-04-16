// seed_stages.ts
// Pobla la tabla stage_pokemon desde stage_pokemon.json en la raíz del proyecto.
//
// Uso:
//   npx tsx src/scripts/seed_stages.ts

import 'reflect-metadata';
import path from 'path';
import { readFileSync } from 'fs';
import { orm } from '../shared/db/orm.js';
import { StagePokemon } from '../stage/stage.entity.js';

const JSON_PATH = path.resolve(process.cwd(), '../stage_pokemon.json');

interface StageJson {
  languages: Record<string, {
    name: string;
    stages: Record<string, string>;
    special: string[];
  }>;
}

async function seed() {
  const em = orm.em.fork();

  const data: StageJson = JSON.parse(readFileSync(JSON_PATH, 'utf8'));

  // Limpiar registros anteriores para evitar duplicados en re-ejecuciones
  await em.nativeDelete(StagePokemon, {});
  console.log('[seed_stages] tabla limpiada');

  const records: StagePokemon[] = [];

  for (const [lang, langData] of Object.entries(data.languages)) {
    // Stages regulares
    for (const [stageKey, value] of Object.entries(langData.stages)) {
      const s = em.create(StagePokemon, { lang, stageKey, value, isSpecial: false });
      records.push(s);
    }
    // Special forms
    for (const value of langData.special) {
      const s = em.create(StagePokemon, { lang, stageKey: 'special', value, isSpecial: true });
      records.push(s);
    }
  }

  await em.persistAndFlush(records);
  console.log(`[seed_stages] ${records.length} registros insertados`);

  await orm.close();
}

seed().catch(err => { console.error(err); process.exit(1); });
