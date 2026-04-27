import { orm } from '../shared/db/orm.js';
import { TiendaRetiro } from '../tiendaRetiro/tiendaRetiro.entity.js';

// DEPRECATED: tiendas se crean via POST /api/tiendas con email+password real.
// Este script ya no debe ejecutarse; los datos seran eliminados en la migracion.
const TIENDAS = [
  {
    nombre: 'TCG Rosario Centro',
    direccion: 'Córdoba 1240, Rosario, Santa Fe',
    horario: 'Lun–Vie 10:00–20:00 | Sáb 10:00–14:00',
    activo: true,
    email: 'tcg-centro@placeholder.local',
    password: 'DEPRECATED',
  },
  {
    nombre: 'Cards & Games',
    direccion: 'San Martín 456, Rosario, Santa Fe',
    horario: 'Lun–Sáb 10:00–19:00',
    activo: true,
    email: 'cards-games@placeholder.local',
    password: 'DEPRECATED',
  },
  {
    nombre: 'Hobby Stop Rosario',
    direccion: 'Mitre 789, Rosario, Santa Fe',
    horario: 'Lun–Vie 11:00–20:00 | Sáb 11:00–17:00',
    activo: true,
    email: 'hobby-stop@placeholder.local',
    password: 'DEPRECATED',
  },
  {
    nombre: 'El Coleccionista',
    direccion: 'Belgrano 321, Rosario, Santa Fe',
    horario: 'Mar–Dom 12:00–20:00',
    activo: true,
    email: 'el-coleccionista@placeholder.local',
    password: 'DEPRECATED',
  },
];

async function seed() {
  const em = orm.em.fork();

  for (const data of TIENDAS) {
    const existe = await em.findOne(TiendaRetiro, { nombre: data.nombre });
    if (!existe) {
      em.create(TiendaRetiro, data);
      console.log(`Creada: ${data.nombre}`);
    } else {
      console.log(`Ya existe: ${data.nombre}`);
    }
  }

  await em.flush();
  console.log('Seed de tiendas completado.');
  await orm.close();
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
