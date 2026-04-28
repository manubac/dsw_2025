import bcrypt from 'bcryptjs';
import { orm } from '../shared/db/orm.js';
import { User } from '../user/user.entity.js';

const SALT_ROUNDS = 10;

const USERS = [
  { username: 'ash', email: 'ash@ash.com', password: '1234' },
  { username: 'bruno', email: 'brunoleosanti@gmail.com', password: '1234' },
  { username: 'manuel', email: 'manuelbacolla@gmail.com', password: '1234' },
  { username: 'nicolas', email: 'nicolasvolentiera@gmail.com', password: '1234' },
];

async function seed() {
  const em = orm.em.fork();

  for (const data of USERS) {
    const existe = await em.findOne(User, { email: data.email });
    if (existe) {
      existe.is_email_verified = true;
      console.log(`Ya existe, verificado: ${data.email}`);
    } else {
      const hashedPassword = await bcrypt.hash(data.password, SALT_ROUNDS);
      em.create(User, {
        username: data.username,
        email: data.email,
        password: hashedPassword,
        role: 'user',
        is_email_verified: true,
        is_phone_verified: false,
      });
      console.log(`Creado con email verificado: ${data.email}`);
    }
  }

  await em.flush();
  console.log('Seed de usuarios completado.');
  await orm.close();
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
