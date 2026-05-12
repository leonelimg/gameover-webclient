import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱  Seeding database…');

  // ── Plans ────────────────────────────────────────────────────────────────

  const planBasico = await prisma.plan.upsert({
    where: { id: 'plan-basico' },
    update: {},
    create: {
      id: 'plan-basico',
      name: 'Plan Básico',
      multiplier: 60,
      commission: 10,
    },
  });

  const planPremium = await prisma.plan.upsert({
    where: { id: 'plan-premium' },
    update: {},
    create: {
      id: 'plan-premium',
      name: 'Plan Premium',
      multiplier: 80,
      commission: 15,
    },
  });

  // ── Users ────────────────────────────────────────────────────────────────

  const adminHash = await bcrypt.hash('admin123', 12);
  const defaultHash = await bcrypt.hash('password123', 12);

  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      fullName: 'Administrador Principal',
      username: 'admin',
      email: 'admin@gameover.com',
      phone: '0000-0000',
      role: 'admin',
      status: 'activo',
      passwordHash: adminHash,
    },
  });

  const asociado1 = await prisma.user.upsert({
    where: { username: 'jperez' },
    update: {},
    create: {
      fullName: 'Juan Pérez',
      username: 'jperez',
      email: 'juan@gameover.com',
      phone: '8888-1111',
      role: 'asociado',
      status: 'activo',
      passwordHash: defaultHash,
      planId: planBasico.id,
    },
  });

  const asociado2 = await prisma.user.upsert({
    where: { username: 'mlopez' },
    update: {},
    create: {
      fullName: 'María López',
      username: 'mlopez',
      email: 'maria@gameover.com',
      phone: '8888-2222',
      role: 'asociado',
      status: 'activo',
      passwordHash: defaultHash,
      planId: planPremium.id,
      parentId: asociado1.id,
    },
  });

  // Update plan-premium master to asociado1
  await prisma.plan.update({
    where: { id: planPremium.id },
    data: { masterId: asociado1.id },
  });

  await prisma.user.upsert({
    where: { username: 'cruiz' },
    update: {},
    create: {
      fullName: 'Carlos Ruiz',
      username: 'cruiz',
      email: 'carlos@gameover.com',
      phone: '8888-3333',
      role: 'vendedor',
      status: 'activo',
      passwordHash: defaultHash,
      planId: planBasico.id,
      parentId: asociado1.id,
    },
  });

  // ── Draws ────────────────────────────────────────────────────────────────

  const now = new Date();
  const closeTime = new Date(now);
  closeTime.setHours(21, 0, 0, 0);

  await prisma.draw.upsert({
    where: { id: 'draw-matutino' },
    update: {},
    create: {
      id: 'draw-matutino',
      name: 'Sorteo Matutino',
      closeTime,
      minutosPreviosCierre: 10,
      status: 'abierto',
      restrictedNumbers: {
        create: [
          { number: '00', limit: 500 },
          { number: '11', limit: 300 },
        ],
      },
    },
  });

  console.log('✅  Seed complete');
  console.log('   Admin login: admin / admin123');
  console.log('   Other users: <username> / password123');
  console.log(`   Users: admin(${admin.id}), asociado1(${asociado1.id}), asociado2(${asociado2.id})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
