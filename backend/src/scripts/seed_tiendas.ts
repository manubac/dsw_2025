import { orm } from '../shared/db/orm.js';
import { TiendaRetiro, HorarioSemanal } from '../tiendaRetiro/tiendaRetiro.entity.js';

const HORARIO_DEFAULT: HorarioSemanal = {
  lunes:     { abre: '10:00', cierra: '20:00', cerrado: false },
  martes:    { abre: '10:00', cierra: '20:00', cerrado: false },
  miercoles: { abre: '10:00', cierra: '20:00', cerrado: false },
  jueves:    { abre: '10:00', cierra: '20:00', cerrado: false },
  viernes:   { abre: '10:00', cierra: '20:00', cerrado: false },
  sabado:    { abre: '10:00', cierra: '14:00', cerrado: false },
  domingo:   { abre: '00:00', cierra: '00:00', cerrado: true  },
};

// DEPRECATED: tiendas se crean via POST /api/tiendas con email+password real.
// Este script ya no debe ejecutarse; los datos seran eliminados en la migracion.
const TIENDAS = [
  {
    nombre: 'TCG Rosario Centro',
    direccion: 'Córdoba 1240, Rosario, Santa Fe',
    horario: HORARIO_DEFAULT,
    activo: true,
    email: 'tcg-centro@placeholder.local',
    password: 'DEPRECATED',
  },
  {
    nombre: 'Cards & Games',
    direccion: 'San Martín 456, Rosario, Santa Fe',
    horario: HORARIO_DEFAULT,
    activo: true,
    email: 'cards-games@placeholder.local',
    password: 'DEPRECATED',
  },
  {
    nombre: 'Hobby Stop Rosario',
    direccion: 'Mitre 789, Rosario, Santa Fe',
    horario: HORARIO_DEFAULT,
    activo: true,
    email: 'hobby-stop@placeholder.local',
    password: 'DEPRECATED',
  },
  {
    nombre: 'El Coleccionista',
    direccion: 'Belgrano 321, Rosario, Santa Fe',
    horario: HORARIO_DEFAULT,
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
